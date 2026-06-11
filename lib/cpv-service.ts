import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import {
  CPV_COLLECTIONS,
  CppInput,
  CppRecord,
  CpvStatus,
  CqaInput,
  CqaRecord,
  UtilityInput,
  UtilityRecord,
  YieldInput,
  YieldRecord,
  AssayInput,
  AssayRecord,
  PhysicalInput,
  PhysicalRecord,
  SterilityInput,
  SterilityRecord,
  PreservativeInput,
  PreservativeRecord,
  ParticulateInput,
  ParticulateRecord,
  RiskInput,
  RiskRecord,
  calculateRisk,
  generateRiskId,
  classifyUtility,
  classifySpecification,
  classifyCqaStatus,
  deviationPercent,
} from '@/lib/cpv';

type Actor = { id?: string; name?: string; role?: string };

function serialized<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function listCpvRecords<T>(collectionName: string, max = 500): Promise<T[]> {
  try {
    const snapshot = await getDocs(query(
      collection(firestore, collectionName),
      orderBy('createdAt', 'desc'),
      limit(max),
    ));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as T));
  } catch (error) {
    console.error(`Unable to load ${collectionName}:`, error);
    return [];
  }
}

async function writeAudit(
  action: string,
  module: string,
  recordId: string,
  actor: Actor,
  payload: unknown,
) {
  await addDoc(collection(firestore, CPV_COLLECTIONS.audit), {
    action,
    module,
    recordId,
    actorId: actor.id || 'system',
    actorName: actor.name || 'System',
    actorRole: actor.role || 'unknown',
    payload: serialized(payload),
    timestamp: new Date().toISOString(),
    serverTimestamp: serverTimestamp(),
  });
}

async function resolveBatchLink(batchNo: string, productName?: string) {
  if (!batchNo) {
    return {
      batchId: null as string | null,
      pqrId: null as string | null,
      productName: productName || '',
      batchLinked: false,
    };
  }
  try {
    for (const coll of ['batches', 'pqr_batches']) {
      const snap = await getDocs(query(
        collection(firestore, coll),
        where('batch_number', '==', batchNo),
        limit(1),
      ));
      if (!snap.empty) {
        const data = snap.docs[0].data();
        return {
          batchId: snap.docs[0].id,
          pqrId: String(data.pqr_id || data.pqrId || '') || null,
          productName: productName || String(data.product_name || data.productName || ''),
          batchLinked: true,
        };
      }
    }
  } catch { /* batch collection may not exist */ }
  return { batchId: null, pqrId: null, productName: productName || '', batchLinked: false };
}

export async function loadCppBatches(): Promise<Array<{ id: string; batch_number: string; product_name: string }>> {
  const results: Array<{ id: string; batch_number: string; product_name: string }> = [];
  const collections = ['cpv_batches', 'batches', 'pqr_batches'];
  for (const coll of collections) {
    try {
      const snap = await getDocs(query(collection(firestore, coll), orderBy('created_at', 'desc'), limit(200)));
      snap.docs.forEach((d) => {
        const data = d.data();
        const bn = String(data.batch_number || data.batchNo || data.batchNumber || '');
        const pn = String(data.product_name || data.productName || '');
        if (bn) results.push({ id: d.id, batch_number: bn, product_name: pn });
      });
      if (results.length) break;
    } catch {
      try {
        const snap = await getDocs(query(collection(firestore, coll), limit(200)));
        snap.docs.forEach((d) => {
          const data = d.data();
          const bn = String(data.batch_number || data.batchNo || '');
          if (bn) results.push({ id: d.id, batch_number: bn, product_name: String(data.product_name || '') });
        });
        if (results.length) break;
      } catch { /* continue */ }
    }
  }
  return results;
}

async function createCpvRecord<T>(
  collectionName: string,
  module: string,
  data: T & { batchNo?: string; productName?: string },
  actor: Actor,
) {
  const now = new Date().toISOString();
  const batchLink = data.batchNo
    ? await resolveBatchLink(data.batchNo, data.productName)
    : { batchId: null, pqrId: null, productName: data.productName || '', batchLinked: false };

  const payload = {
    ...serialized(data),
    productName: batchLink.productName || (data as { productName?: string }).productName,
    product_name: batchLink.productName || (data as { productName?: string }).productName,
    batch_number: (data as { batchNo?: string }).batchNo,
    batchId: batchLink.batchId,
    batchLinked: batchLink.batchLinked,
    pqrId: batchLink.pqrId,
    pqr_id: batchLink.pqrId,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.id || 'system',
    createdByName: actor.name || 'System',
    version: 1,
  };
  const reference = await addDoc(collection(firestore, collectionName), payload);
  await writeAudit('CREATE', module, reference.id, actor, payload);
  return { id: reference.id, ...payload };
}

export function createCpp(input: CppInput, actor: Actor) {
  const status = classifySpecification(input.observedValue, input.targetValue, input.lsl, input.usl);
  return createCpvRecord<CppRecord>(
    CPV_COLLECTIONS.cpp,
    'CPP Monitoring',
    { ...input, status, deviationPercent: deviationPercent(input.observedValue, input.targetValue) },
    actor,
  ).then(async (record) => {
    if (['OOT', 'OOS'].includes(status)) {
      const { createDeviationFromCpv } = await import('@/lib/deviation-service');
      await createDeviationFromCpv('cpv_cpp', {
        id: record.id,
        product: input.productName,
        batchNumber: input.batchNo,
        parameter: input.parameterName,
        observedValue: input.observedValue,
        status,
        department: 'Production',
      }, { id: actor.id || 'system', name: actor.name || 'System', role: actor.role || 'qa' });
    }
    return record;
  });
}

export function createCqa(input: CqaInput, actor: Actor) {
  const status = classifyCqaStatus(input.testParameter, input.observedValue, input.target, input.lsl, input.usl);
  return createCpvRecord<CqaRecord>(
    CPV_COLLECTIONS.cqa,
    'CQA Monitoring',
    {
      ...input,
      status,
      deviationPercent: deviationPercent(input.observedValue, input.target),
      test_parameter: input.testParameter,
      test_date: input.testDate,
    } as CqaRecord & { test_parameter?: string; test_date?: string },
    actor,
  ).then(async (record) => {
    if (['OOT', 'OOS'].includes(status)) {
      const { createDeviationFromCpv } = await import('@/lib/deviation-service');
      await createDeviationFromCpv('cpv_cqa', {
        id: record.id,
        product: input.productName,
        batchNumber: input.batchNo,
        parameter: input.testParameter,
        observedValue: input.observedValue,
        status,
        department: 'QC',
      }, { id: actor.id || 'system', name: actor.name || 'System', role: actor.role || 'qc' });
    }
    if (status === 'OOS') {
      const { createOosFromCpv } = await import('@/lib/oos-service');
      await createOosFromCpv({
        id: record.id,
        product: input.productName,
        batchNumber: input.batchNo,
        parameter: input.testParameter,
        observedValue: input.observedValue,
        lower: input.lsl,
        upper: input.usl,
        unit: input.unit,
        status,
      }, { id: actor.id || 'system', name: actor.name || 'System', role: actor.role || 'qc' });
    }
    return record;
  });
}

export function createYield(input: YieldInput, actor: Actor) {
  const status = classifySpecification(
    input.observedValue,
    (input.lowerLimit + input.upperLimit) / 2,
    input.lowerLimit,
    input.upperLimit,
  );
  return createCpvRecord<YieldRecord>(
    CPV_COLLECTIONS.yield,
    'Yield Monitoring',
    { ...input, status },
    actor,
  );
}

export function createUtility(input: UtilityInput, actor: Actor) {
  return createCpvRecord<UtilityRecord>(
    CPV_COLLECTIONS.utility,
    'Utility Parameters',
    { ...input, ...classifyUtility(input) },
    actor,
  );
}

export function createAssay(input: AssayInput, actor: Actor) {
  const status = classifySpecification(
    input.observedValue,
    input.assayPercent,
    input.lowerLimit,
    input.upperLimit,
  );
  return createCpvRecord<AssayRecord>(
    CPV_COLLECTIONS.cqaAssay,
    'CQA Assay Monitoring',
    { ...input, status },
    actor,
  );
}

export function createPhysical(input: PhysicalInput, actor: Actor) {
  return createCpvRecord<PhysicalRecord>(
    CPV_COLLECTIONS.cqaPhysical,
    'CQA Physical Parameters',
    input,
    actor,
  );
}

export function createSterility(input: SterilityInput, actor: Actor) {
  return createCpvRecord<SterilityRecord>(
    CPV_COLLECTIONS.cqaSterility,
    'CQA Sterility Monitoring',
    { ...input, status: input.passFail },
    actor,
  );
}

export function createPreservative(input: PreservativeInput, actor: Actor) {
  const status = classifySpecification(
    input.observedValue,
    (input.lsl + input.usl) / 2,
    input.lsl,
    input.usl,
  );
  return createCpvRecord<PreservativeRecord>(
    CPV_COLLECTIONS.cqaPreservative,
    'CQA Preservative Monitoring',
    { ...input, status },
    actor,
  );
}

export function createParticulate(input: ParticulateInput, actor: Actor) {
  const status: CpvStatus = input.observedValue > input.limit
    ? 'OOS'
    : input.observedValue >= input.limit * 0.9
      ? 'OOT'
      : 'Complies';
  return createCpvRecord<ParticulateRecord>(
    CPV_COLLECTIONS.cqaParticulate,
    'CQA Particulate Monitoring',
    { ...input, status },
    actor,
  );
}

export function createRisk(input: RiskInput, actor: Actor, existingCount = 0) {
  const riskId = input.riskId || generateRiskId(existingCount);
  return createCpvRecord<RiskRecord>(
    CPV_COLLECTIONS.risk,
    'Risk Assessment',
    {
      ...input,
      riskId,
      ...calculateRisk(input.occurrence, input.severity, input.detectability),
    },
    actor,
  );
}

export async function loadIntegrationSnapshot() {
  const names = {
    batches: ['batches', 'pqr_batches'],
    deviations: ['deviations'],
    oos: ['oos_records', 'oos'],
    capa: ['capa_records', 'capa'],
    pqr: ['pqr_documents', 'pqr_records'],
    stability: ['stability_studies', 'stability'],
  };

  const readFirstAvailable = async (candidates: string[]) => {
    for (const name of candidates) {
      try {
        const snapshot = await getDocs(query(collection(firestore, name), limit(500)));
        if (!snapshot.empty) return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      } catch {
        // Try the next known collection name.
      }
    }
    return [];
  };

  const [batches, deviations, oos, capa, pqr, stability] = await Promise.all(
    Object.values(names).map(readFirstAvailable),
  );
  return { batches, deviations, oos, capa, pqr, stability };
}
