import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { validateRecordMetadata } from '@/lib/database-registry';
import { CPV_COLLECTIONS, classifySpecification } from '@/lib/cpv';
import {
  CPV_MODULE_COLLECTIONS,
  type BatchInput,
  type BatchRecord,
  type RawMaterialInput,
  type RawMaterialRecord,
  type PackingMaterialInput,
  type PackingMaterialRecord,
  type UtilityMonitoringInput,
  type UtilityMonitoringRecord,
  type EnvironmentInput,
  type EnvironmentRecord,
  type YieldMonitoringInput,
  type YieldMonitoringRecord,
  type StabilityInput,
  type StabilityRecord,
  type HoldTimeInput,
  type HoldTimeRecord,
  type CpvAlertRecord,
  calculateYieldMetrics,
  calculateHoldTimeStatus,
  classifyEnvironment,
  rawMaterialStatus,
  stabilityStatus,
  calculateVendorScore,
} from '@/lib/cpv-modules';

type Actor = { id?: string; name?: string; role?: string };

function serialized<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function writeAudit(action: string, module: string, recordId: string, actor: Actor, payload: unknown) {
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

export async function listModuleRecords<T>(collectionName: string, max = 500): Promise<T[]> {
  try {
    const snapshot = await getDocs(query(
      collection(firestore, collectionName),
      orderBy('createdAt', 'desc'),
      limit(max),
    ));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as T));
  } catch {
    try {
      const snapshot = await getDocs(query(collection(firestore, collectionName), limit(max)));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as T));
    } catch (error) {
      console.error(`Unable to load ${collectionName}:`, error);
      return [];
    }
  }
}

async function createModuleRecord<T>(
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

async function updateModuleRecord<T extends Record<string, unknown>>(
  collectionName: string,
  module: string,
  id: string,
  data: Partial<T>,
  actor: Actor,
) {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  await updateDoc(doc(firestore, collectionName, id), payload);
  await writeAudit('UPDATE', module, id, actor, payload);
}

export async function createBatch(input: BatchInput, actor: Actor) {
  const record = await createModuleRecord(
    CPV_MODULE_COLLECTIONS.batches,
    'Batch Registration',
    {
      ...input,
      batch_number: input.batchNumber,
      product_name: input.productName,
    } as BatchRecord,
    actor,
  );
  try {
    await addDoc(collection(firestore, 'batches'), {
      batch_number: input.batchNumber,
      product_name: input.productName,
      product_code: input.productCode,
      manufacturing_date: input.manufacturingDate,
      expiry_date: input.expiryDate,
      batch_size: input.batchSize,
      market: input.market,
      shift: input.shift,
      manufacturing_line: input.manufacturingLine,
      status: input.status,
      source: 'cpv',
      cpv_batch_id: record.id,
      created_at: new Date().toISOString(),
    });
  } catch { /* batches collection may not exist */ }
  return record;
}

export async function updateBatchStatus(id: string, status: BatchInput['status'], actor: Actor, reviewedBy?: string) {
  await updateModuleRecord(CPV_MODULE_COLLECTIONS.batches, 'Batch Registration', id, {
    status,
    reviewedBy: reviewedBy || actor.name || '',
    approvedBy: status === 'Approved' ? actor.name || '' : undefined,
  }, actor);
}

export async function createRawMaterial(input: RawMaterialInput, actor: Actor, allRecords: RawMaterialRecord[] = []) {
  const status = rawMaterialStatus(input.assay, input.lsl, input.usl);
  const vendorScore = calculateVendorScore([...allRecords, { ...input, status, vendorScore: 0, id: '' }], input.vendor);
  const record = await createModuleRecord<RawMaterialRecord>(
    CPV_MODULE_COLLECTIONS.rawMaterials,
    'Raw Material Monitoring',
    { ...input, status, vendorScore },
    actor,
  );
  if (status !== 'Complies') {
    await createAlert({
      alertType: status === 'OOS' ? 'Limit Exceeded' : 'OOT',
      severity: status === 'OOS' ? 'High' : 'Medium',
      module: 'Raw Material Monitoring',
      productName: input.productName,
      batchNo: input.batchNo,
      parameterName: 'Assay',
      message: `${input.apiName} assay ${status} for batch ${input.batchNo}`,
      observedValue: input.assay,
      recordId: record.id,
    }, actor);
  }
  return record;
}

export async function createPackingMaterial(input: PackingMaterialInput, actor: Actor) {
  return createModuleRecord<PackingMaterialRecord>(
    CPV_MODULE_COLLECTIONS.packingMaterials,
    'Packing Material Monitoring',
    input,
    actor,
  );
}

export async function createUtilityRecord(input: UtilityMonitoringInput, actor: Actor) {
  const status = classifySpecification(input.observedValue, (input.lsl + input.usl) / 2, input.lsl, input.usl);
  const record = await createModuleRecord<UtilityMonitoringRecord>(
    CPV_MODULE_COLLECTIONS.utilityMonitoring,
    'Utility Monitoring',
    { ...input, status },
    actor,
  );
  if (status !== 'Complies') {
    await createAlert({
      alertType: status === 'OOS' ? 'Limit Exceeded' : 'OOT',
      severity: status === 'OOS' ? 'Critical' : 'Medium',
      module: 'Utility Monitoring',
      productName: input.productName || input.utilityType,
      batchNo: input.batchNo || 'N/A',
      parameterName: input.parameterName,
      message: `${input.utilityType} ${input.parameterName} ${status}`,
      observedValue: input.observedValue,
      recordId: record.id,
    }, actor);
  }
  return record;
}

export async function createEnvironment(input: EnvironmentInput, actor: Actor) {
  const status = classifyEnvironment(input);
  const record = await createModuleRecord<EnvironmentRecord>(
    CPV_MODULE_COLLECTIONS.environment,
    'Environmental Monitoring',
    { ...input, status },
    actor,
  );
  if (status !== 'Complies') {
    await createAlert({
      alertType: status === 'OOS' ? 'Limit Exceeded' : 'OOT',
      severity: status === 'OOS' ? 'High' : 'Medium',
      module: 'Environmental Monitoring',
      productName: input.area,
      batchNo: input.recordedDate,
      parameterName: 'Temperature/Humidity',
      message: `Environmental excursion in ${input.area} Grade ${input.grade}`,
      recordId: record.id,
    }, actor);
  }
  return record;
}

export async function createYieldRecord(input: YieldMonitoringInput, actor: Actor) {
  const { yieldPercent, variancePercent, status } = calculateYieldMetrics(input.expectedYield, input.actualYield);
  const record = await createModuleRecord<YieldMonitoringRecord>(
    CPV_MODULE_COLLECTIONS.yieldMonitoring,
    'Yield Monitoring',
    { ...input, yieldPercent, variancePercent, status },
    actor,
  );
  if (status !== 'Complies') {
    await createAlert({
      alertType: 'Trend Deteriorating',
      severity: status === 'OOS' ? 'High' : 'Medium',
      module: 'Yield Monitoring',
      productName: input.productName,
      batchNo: input.batchNo,
      parameterName: input.stage,
      message: `${input.stage} yield ${yieldPercent}% (${status})`,
      observedValue: yieldPercent,
      recordId: record.id,
    }, actor);
  }
  return record;
}

export async function createStability(input: StabilityInput, actor: Actor) {
  const status = stabilityStatus(input.observedValue, input.lsl, input.usl);
  return createModuleRecord<StabilityRecord>(
    CPV_MODULE_COLLECTIONS.stability,
    'Stability Monitoring',
    { ...input, status },
    actor,
  );
}

export async function createHoldTime(input: HoldTimeInput, actor: Actor) {
  const status = calculateHoldTimeStatus(input.allowedTime, input.actualTime);
  const variancePercent = input.allowedTime === 0
    ? 0
    : Number((((input.actualTime - input.allowedTime) / input.allowedTime) * 100).toFixed(2));
  const record = await createModuleRecord<HoldTimeRecord>(
    CPV_MODULE_COLLECTIONS.holdTime,
    'Hold Time Monitoring',
    { ...input, status, variancePercent },
    actor,
  );
  if (status === 'Fail') {
    await createAlert({
      alertType: 'Limit Exceeded',
      severity: 'High',
      module: 'Hold Time Monitoring',
      productName: input.productName,
      batchNo: input.batchNo,
      parameterName: input.stage,
      message: `Hold time exceeded at ${input.stage}: ${input.actualTime}${input.unit} vs ${input.allowedTime}${input.unit} allowed`,
      observedValue: input.actualTime,
      recordId: record.id,
    }, actor);
  }
  return record;
}

export async function createAlert(
  input: Omit<CpvAlertRecord, 'id' | 'createdAt' | 'status'>,
  actor: Actor,
) {
  const payload = {
    ...input,
    status: 'Open' as const,
    createdAt: new Date().toISOString(),
    createdBy: actor.name || 'System',
  };
  const ref = await addDoc(collection(firestore, CPV_MODULE_COLLECTIONS.alerts), payload);
  return { id: ref.id, ...payload };
}

export async function acknowledgeAlert(id: string, actor: Actor) {
  await updateModuleRecord(CPV_MODULE_COLLECTIONS.alerts, 'Alert Engine', id, { status: 'Acknowledged' }, actor);
}

export async function closeAlert(id: string, actor: Actor) {
  await updateModuleRecord(CPV_MODULE_COLLECTIONS.alerts, 'Alert Engine', id, { status: 'Closed' }, actor);
}

export async function listAlerts(max = 200): Promise<CpvAlertRecord[]> {
  return listModuleRecords<CpvAlertRecord>(CPV_MODULE_COLLECTIONS.alerts, max);
}

export async function listBatches(max = 500): Promise<BatchRecord[]> {
  return listModuleRecords<BatchRecord>(CPV_MODULE_COLLECTIONS.batches, max);
}

export async function loadAllCpvModules() {
  const [
    batches, rawMaterials, packingMaterials, utilityMonitoring,
    environment, yieldMonitoring, stability, holdTime, alerts,
  ] = await Promise.all([
    listBatches(),
    listModuleRecords<RawMaterialRecord>(CPV_MODULE_COLLECTIONS.rawMaterials),
    listModuleRecords<PackingMaterialRecord>(CPV_MODULE_COLLECTIONS.packingMaterials),
    listModuleRecords<UtilityMonitoringRecord>(CPV_MODULE_COLLECTIONS.utilityMonitoring),
    listModuleRecords<EnvironmentRecord>(CPV_MODULE_COLLECTIONS.environment),
    listModuleRecords<YieldMonitoringRecord>(CPV_MODULE_COLLECTIONS.yieldMonitoring),
    listModuleRecords<StabilityRecord>(CPV_MODULE_COLLECTIONS.stability),
    listModuleRecords<HoldTimeRecord>(CPV_MODULE_COLLECTIONS.holdTime),
    listAlerts(),
  ]);
  return {
    batches, rawMaterials, packingMaterials, utilityMonitoring,
    environment, yieldMonitoring, stability, holdTime, alerts,
  };
}

export async function deleteBatch(id: string, actor: Actor) {
  await deleteDoc(doc(firestore, CPV_MODULE_COLLECTIONS.batches, id));
  await writeAudit('DELETE', 'Batch Registration', id, actor, {});
}
