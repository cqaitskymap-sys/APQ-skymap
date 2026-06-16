import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import {
  CPV_CONFIG_COLLECTIONS,
  type CpvConfigBundle,
  type ParameterSpecResolved,
} from '@/lib/cpv-config';
import {
  CPV_COLLECTIONS,
  CQA_PARAMETER_SPECS,
  CQA_PARAMETERS,
  PARAMETER_SPECS,
  PROCESS_PARAMETERS,
} from '@/lib/cpv';

type Actor = { id?: string; name?: string; role?: string };

export async function listConfigRecords<T extends { isDeleted?: boolean }>(collectionName: string, max = 500): Promise<T[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), collectionName),
      orderBy('updatedAt', 'desc'),
      limit(max),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), collectionName), limit(max)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T)).filter((r) => r.isDeleted !== true);
    } catch {
      return [];
    }
  }
}

async function writeConfigAudit(action: string, collectionName: string, recordId: string, actor: Actor) {
  await addDoc(collection(getFirebaseFirestore(), CPV_COLLECTIONS.audit), {
    action,
    module: 'CPV Configuration',
    collection: collectionName,
    recordId,
    actorId: actor.id || 'system',
    actorName: actor.name || 'System',
    timestamp: new Date().toISOString(),
    serverTimestamp: serverTimestamp(),
  });
}

export async function createConfigRecord<T extends Record<string, unknown>>(
  collectionName: string,
  data: T,
  actor: Actor,
) {
  const now = new Date().toISOString();
  const payload = { ...data, createdAt: now, updatedAt: now, createdBy: actor.name || 'System', updatedBy: actor.id || actor.name || 'System', isDeleted: false };
  const ref = await addDoc(collection(getFirebaseFirestore(), collectionName), payload);
  await writeConfigAudit('CREATE', collectionName, ref.id, actor);
  return { id: ref.id, ...payload };
}

export async function updateConfigRecord<T extends Record<string, unknown>>(
  collectionName: string,
  id: string,
  data: Partial<T>,
  actor: Actor,
) {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  await updateDoc(doc(getFirebaseFirestore(), collectionName, id), payload);
  await writeConfigAudit('UPDATE', collectionName, id, actor);
}

export async function removeConfigRecord(collectionName: string, id: string, actor: Actor) {
  const payload = { isDeleted: true, updatedAt: new Date().toISOString(), updatedBy: actor.id || actor.name || 'System' };
  await updateDoc(doc(getFirebaseFirestore(), collectionName, id), payload);
  await writeConfigAudit('DELETE', collectionName, id, actor);
}

export async function loadCpvConfig(): Promise<CpvConfigBundle> {
  const [
    products, cppMaster, cqaMaster, limits, controlLimits,
    targets, sampling, alerts, review, workflow,
  ] = await Promise.all([
    listConfigRecords(CPV_CONFIG_COLLECTIONS.products),
    listConfigRecords(CPV_CONFIG_COLLECTIONS.cppMaster),
    listConfigRecords(CPV_CONFIG_COLLECTIONS.cqaMaster),
    listConfigRecords(CPV_CONFIG_COLLECTIONS.limits),
    listConfigRecords(CPV_CONFIG_COLLECTIONS.controlLimits),
    listConfigRecords(CPV_CONFIG_COLLECTIONS.targets),
    listConfigRecords(CPV_CONFIG_COLLECTIONS.sampling),
    listConfigRecords(CPV_CONFIG_COLLECTIONS.alerts),
    listConfigRecords(CPV_CONFIG_COLLECTIONS.review),
    listConfigRecords(CPV_CONFIG_COLLECTIONS.workflow),
  ]);
  return {
    products, cppMaster, cqaMaster, limits, controlLimits,
    targets, sampling, alerts, review, workflow,
  } as CpvConfigBundle;
}

function matchProduct(recordProduct: string, productName?: string): boolean {
  if (!productName) return true;
  return recordProduct === productName || recordProduct === 'All Products';
}

function activeOnly<T extends { status?: string }>(records: T[]): T[] {
  return records.filter((r) => r.status !== 'Inactive');
}

export function resolveCppParameterSpec(
  config: CpvConfigBundle,
  parameterName: string,
  productName?: string,
): ParameterSpecResolved | null {
  const cpp = activeOnly(config.cppMaster).find(
    (r) => r.parameterName === parameterName && matchProduct(r.productName, productName),
  );
  if (cpp) {
    return {
      target: cpp.target,
      lsl: cpp.lsl,
      usl: cpp.usl,
      unit: cpp.unit,
      samplingFrequency: cpp.samplingFrequency,
      source: 'config',
    };
  }

  const limit = activeOnly(config.limits).find(
    (r) => r.parameterName === parameterName && r.parameterType === 'CPP' && matchProduct(r.productName, productName),
  );
  const target = activeOnly(config.targets).find(
    (r) => r.parameterName === parameterName && r.parameterType === 'CPP' && matchProduct(r.productName, productName),
  );
  const sampling = activeOnly(config.sampling).find(
    (r) => r.parameterName === parameterName && r.module === 'CPP' && matchProduct(r.productName, productName),
  );

  const defaultSpec = PARAMETER_SPECS[parameterName];
  if (limit || target || defaultSpec) {
    return {
      target: target?.target ?? defaultSpec?.target ?? 0,
      lsl: limit?.lsl ?? defaultSpec?.lsl ?? 0,
      usl: limit?.usl ?? defaultSpec?.usl ?? 0,
      unit: target?.unit ?? limit?.unit ?? defaultSpec?.unit ?? '',
      samplingFrequency: sampling?.frequency,
      source: limit || target ? 'config' : 'default',
    };
  }
  return null;
}

export function resolveCqaParameterSpec(
  config: CpvConfigBundle,
  testParameter: string,
  productName?: string,
): ParameterSpecResolved | null {
  const cqa = activeOnly(config.cqaMaster).find(
    (r) => r.testParameter === testParameter && matchProduct(r.productName, productName),
  );
  if (cqa) {
    return {
      target: cqa.target,
      lsl: cqa.lsl,
      usl: cqa.usl,
      unit: cqa.unit,
      samplingFrequency: cqa.samplingFrequency,
      source: 'config',
    };
  }

  const limit = activeOnly(config.limits).find(
    (r) => r.parameterName === testParameter && r.parameterType === 'CQA' && matchProduct(r.productName, productName),
  );
  const target = activeOnly(config.targets).find(
    (r) => r.parameterName === testParameter && r.parameterType === 'CQA' && matchProduct(r.productName, productName),
  );
  const sampling = activeOnly(config.sampling).find(
    (r) => r.parameterName === testParameter && r.module === 'CQA' && matchProduct(r.productName, productName),
  );

  const defaultSpec = CQA_PARAMETER_SPECS[testParameter as keyof typeof CQA_PARAMETER_SPECS];
  if (limit || target || defaultSpec) {
    return {
      target: target?.target ?? defaultSpec?.target ?? 0,
      lsl: limit?.lsl ?? defaultSpec?.lsl ?? 0,
      usl: limit?.usl ?? defaultSpec?.usl ?? 0,
      unit: target?.unit ?? limit?.unit ?? defaultSpec?.unit ?? '',
      samplingFrequency: sampling?.frequency,
      source: limit || target ? 'config' : 'default',
    };
  }
  return null;
}

export async function seedDefaultCpvConfig(actor: Actor): Promise<{ created: number }> {
  const existing = await loadCpvConfig();
  if (existing.cppMaster.length || existing.cqaMaster.length) {
    return { created: 0 };
  }

  let created = 0;
  const product = 'All Products';

  for (const param of PROCESS_PARAMETERS) {
    const spec = PARAMETER_SPECS[param];
    if (!spec) continue;
    await createConfigRecord(CPV_CONFIG_COLLECTIONS.cppMaster, {
      productName: product,
      parameterName: param,
      processStage: 'Manufacturing',
      ...spec,
      samplingFrequency: 'Per Batch',
      status: 'Active',
    }, actor);
    created++;
  }

  for (const param of CQA_PARAMETERS) {
    const spec = CQA_PARAMETER_SPECS[param];
    await createConfigRecord(CPV_CONFIG_COLLECTIONS.cqaMaster, {
      productName: product,
      testParameter: param,
      target: spec.target,
      lsl: spec.lsl,
      usl: spec.usl,
      unit: spec.unit,
      parameterType: spec.type,
      samplingFrequency: 'Per Batch',
      status: 'Active',
    }, actor);
    created++;
  }

  await createConfigRecord(CPV_CONFIG_COLLECTIONS.review, {
    module: 'CPV',
    productName: product,
    frequency: 'Annual',
    nextReviewDate: '',
    status: 'Active',
  }, actor);
  created++;

  await createConfigRecord(CPV_CONFIG_COLLECTIONS.workflow, {
    module: 'CPV',
    stepOrder: 1,
    designation: 'CPV Coordinator',
    role: 'qa',
    eSignRequired: true,
    status: 'Active',
  }, actor);
  await createConfigRecord(CPV_CONFIG_COLLECTIONS.workflow, {
    module: 'CPV',
    stepOrder: 2,
    designation: 'QA Manager',
    role: 'qa',
    eSignRequired: true,
    status: 'Active',
  }, actor);
  await createConfigRecord(CPV_CONFIG_COLLECTIONS.workflow, {
    module: 'CPV',
    stepOrder: 3,
    designation: 'Head QA',
    role: 'qa',
    eSignRequired: true,
    status: 'Active',
  }, actor);
  created += 3;

  return { created };
}
