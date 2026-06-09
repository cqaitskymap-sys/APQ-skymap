import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
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
  classifyUtility,
  classifySpecification,
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

async function createCpvRecord<T>(
  collectionName: string,
  module: string,
  data: T,
  actor: Actor,
) {
  const now = new Date().toISOString();
  const payload = {
    ...serialized(data),
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
  );
}

export function createCqa(input: CqaInput, actor: Actor) {
  const status = classifySpecification(input.observedValue, input.target, input.lsl, input.usl);
  return createCpvRecord<CqaRecord>(
    CPV_COLLECTIONS.cqa,
    'CQA Monitoring',
    { ...input, status, deviationPercent: deviationPercent(input.observedValue, input.target) },
    actor,
  );
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

export function createRisk(input: RiskInput, actor: Actor) {
  return createCpvRecord<RiskRecord>(
    CPV_COLLECTIONS.risk,
    'Risk Assessment',
    { ...input, ...calculateRisk(input.likelihood, input.severity, input.detectability) },
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
