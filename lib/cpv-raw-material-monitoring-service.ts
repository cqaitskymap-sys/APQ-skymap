import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createRecord, getRecord, getRecords, updateRecord, type DocumentActor } from '@/lib/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { getMaterialMasters } from '@/lib/material-service';
import { listReceipts } from '@/lib/warehouse-mgmt-service';
import { listVendors } from '@/lib/vendor-mgmt-service';
import { fetchCpvProductById } from '@/lib/cpv-product-master-service';
import { fetchCpvBatches } from '@/lib/cpv-batch-registration-service';
import { listCpvRecords } from '@/lib/cpv-service';
import { CPV_COLLECTIONS } from '@/lib/cpv';
import { createAlert } from '@/lib/cpv-module-service';
import {
  RAW_MATERIAL_MONITORING_COLLECTION,
  RAW_MATERIAL_LEGACY_COLLECTION,
  RAW_MATERIAL_MODULE_NAME,
  buildRawMaterialMonitoringId,
  evaluateRawMaterialCompliance,
  evaluateRawMaterialRisk,
  isMaterialExpired,
  isRetestOverdue,
  type RawMaterialMonitoringFormData,
  type RawMaterialMonitoringRecord,
  type RawMaterialAttachment,
} from '@/lib/cpv-raw-material-monitoring';

export interface RawMaterialActor {
  id: string;
  name: string;
  role?: string;
}

function actorCtx(actor: RawMaterialActor) {
  return { moduleName: RAW_MATERIAL_MODULE_NAME, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logRmAudit(actionType: string, recordId: string, actor: RawMaterialActor, oldVal?: unknown, newVal?: unknown, docNo?: string) {
  await createAuditLog({
    moduleName: RAW_MATERIAL_MODULE_NAME,
    collectionName: RAW_MATERIAL_MONITORING_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: RAW_MATERIAL_MONITORING_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: RAW_MATERIAL_MODULE_NAME,
  });
}

function str(v: unknown, fb = ''): string {
  if (v === null || v === undefined) return fb;
  return String(v);
}

function num(v: unknown, fb = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function normalizeRawMaterialRecord(raw: Record<string, unknown>): RawMaterialMonitoringRecord {
  const batchNumber = str(raw.batchNumber || raw.batchNo || raw.batch_number);
  const materialCode = str(raw.materialCode || raw.material_code, 'MAT');
  const arNumber = str(raw.arNumber || raw.arNo || raw.ar_number);
  const attachments = Array.isArray(raw.attachments) ? raw.attachments as RawMaterialAttachment[] : [];
  return {
    id: str(raw.id),
    rawMaterialMonitoringId: str(raw.rawMaterialMonitoringId || raw.raw_material_monitoring_id, buildRawMaterialMonitoringId(batchNumber, materialCode, arNumber)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    batchNumber,
    materialCode,
    materialName: str(raw.materialName || raw.material_name || raw.apiName),
    materialType: (str(raw.materialType || raw.material_type, 'API') as RawMaterialMonitoringRecord['materialType']),
    materialGrade: str(raw.materialGrade || raw.material_grade || raw.grade),
    manufacturerName: str(raw.manufacturerName || raw.manufacturer_name),
    supplierName: str(raw.supplierName || raw.supplier_name),
    vendorId: str(raw.vendorId || raw.vendor_id),
    vendorName: str(raw.vendorName || raw.vendor_name || raw.vendor),
    vendorStatus: str(raw.vendorStatus || raw.vendor_status, 'Active'),
    avlStatus: str(raw.avlStatus || raw.avl_status, 'Approved'),
    grnNumber: str(raw.grnNumber || raw.grnNo || raw.grn_number),
    arNumber,
    coaNumber: str(raw.coaNumber || raw.coa_number),
    materialLotNumber: str(raw.materialLotNumber || raw.material_lot_number || raw.batch_lot_number),
    mfgDate: str(raw.mfgDate || raw.mfg_date),
    expDate: str(raw.expDate || raw.exp_date),
    retestDate: str(raw.retestDate || raw.retest_date),
    receivedQuantity: num(raw.receivedQuantity ?? raw.received_quantity),
    issuedQuantity: num(raw.issuedQuantity ?? raw.issued_quantity),
    usedQuantity: num(raw.usedQuantity ?? raw.used_quantity),
    unit: str(raw.unit),
    storageCondition: str(raw.storageCondition || raw.storage_condition),
    qcStatus: (str(raw.qcStatus || raw.qc_status, 'Under Test') as RawMaterialMonitoringRecord['qcStatus']),
    coaAvailable: (str(raw.coaAvailable || raw.coa_available, 'No') as RawMaterialMonitoringRecord['coaAvailable']),
    specificationNumber: str(raw.specificationNumber || raw.specification_number || raw.specificationNo),
    stpNumber: str(raw.stpNumber || raw.stp_number || raw.testMethodStp),
    testParameter: str(raw.testParameter || raw.test_parameter),
    observedResult: ((): string | number | undefined => {
      const v = raw.observedResult ?? raw.observed_result ?? raw.assay;
      if (v === null || v === undefined) return undefined;
      if (typeof v === 'number' || typeof v === 'string') return v;
      return String(v);
    })(),
    lowerLimit: num(raw.lowerLimit ?? raw.lower_limit ?? raw.lsl),
    upperLimit: num(raw.upperLimit ?? raw.upper_limit ?? raw.usl),
    testUnit: str(raw.testUnit || raw.test_unit),
    remarks: str(raw.remarks),
    complianceStatus: str(raw.complianceStatus || raw.compliance_status || raw.status, 'Complies'),
    riskLevel: str(raw.riskLevel || raw.risk_level, 'Low'),
    deviationRequired: Boolean(raw.deviationRequired || raw.deviation_required),
    linkedDeviationNumber: str(raw.linkedDeviationNumber || raw.linked_deviation_number),
    oosRequired: Boolean(raw.oosRequired || raw.oos_required),
    linkedOosNumber: str(raw.linkedOosNumber || raw.linked_oos_number),
    capaRequired: Boolean(raw.capaRequired || raw.capa_required),
    linkedCapaNumber: str(raw.linkedCapaNumber || raw.linked_capa_number),
    reviewStatus: (str(raw.reviewStatus || raw.review_status, 'Draft') as RawMaterialMonitoringRecord['reviewStatus']),
    isLocked: Boolean(raw.isLocked || raw.is_locked),
    attachments,
    warehouseReceiptId: str(raw.warehouseReceiptId || raw.warehouse_receipt_id),
    createdAt: str(raw.createdAt || raw.created_at),
    updatedAt: str(raw.updatedAt || raw.updated_at),
    createdBy: str(raw.createdBy || raw.created_by),
    updatedBy: str(raw.updatedBy || raw.updated_by),
    createdByName: str(raw.createdByName),
    updatedByName: str(raw.updatedByName),
    isDeleted: Boolean(raw.isDeleted),
  };
}

export async function fetchRawMaterialRecords(max = 500): Promise<RawMaterialMonitoringRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: RawMaterialMonitoringRecord[] = [];
    try {
      primary = await getRecords<RawMaterialMonitoringRecord>(RAW_MATERIAL_MONITORING_COLLECTION, [orderBy('createdAt', 'desc'), limit(max)]);
    } catch {
      primary = await getRecords<RawMaterialMonitoringRecord>(RAW_MATERIAL_MONITORING_COLLECTION, [limit(max)]);
    }
    const normalized = primary.map((r) => normalizeRawMaterialRecord(r as unknown as Record<string, unknown>));
    if (normalized.length) return normalized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const legacy = await listCpvRecords<Record<string, unknown>>(CPV_COLLECTIONS.rawMaterials, max);
    return legacy.map((r) => normalizeRawMaterialRecord(r));
  } catch (e) {
    console.error('fetchRawMaterialRecords failed', e);
    return [];
  }
}

export async function fetchRawMaterialRecordById(id: string): Promise<RawMaterialMonitoringRecord | null> {
  const record = await getRecord<RawMaterialMonitoringRecord>(RAW_MATERIAL_MONITORING_COLLECTION, id);
  if (record) return normalizeRawMaterialRecord(record as unknown as Record<string, unknown>);
  const all = await fetchRawMaterialRecords();
  return all.find((r) => r.id === id) ?? null;
}

export async function fetchMaterialMasterOptions() {
  try {
    return await getMaterialMasters({ status: 'Active' });
  } catch {
    return [];
  }
}

export async function fetchVendorOptions() {
  try {
    return await listVendors({});
  } catch {
    return [];
  }
}

export async function fetchWarehouseReceiptsForImport() {
  try {
    return await listReceipts();
  } catch {
    return [];
  }
}

export async function fetchRmBatchesForProduct(productName: string) {
  const batches = await fetchCpvBatches();
  return batches.filter((b) => b.productName === productName || b.productCode === productName);
}

async function countMaterialIssues(materialCode: string, batchNumber: string): Promise<number> {
  const results = await fetchRawMaterialRecords(1000);
  return results.filter((r) =>
    r.materialCode === materialCode
    && r.batchNumber === batchNumber
    && r.complianceStatus !== 'Complies'
    && !r.isDeleted,
  ).length;
}

async function maybeCreateDeviation(record: RawMaterialMonitoringRecord, actor: RawMaterialActor): Promise<string> {
  if (record.qcStatus !== 'Rejected') return '';
  try {
    const { createDeviationFromCpv } = await import('@/lib/deviation-service');
    const dev = await createDeviationFromCpv('cpv_cqa', {
      id: record.id,
      product: record.productName,
      batchNumber: record.batchNumber,
      parameter: record.materialName,
      observedValue: Number(record.observedResult) || 0,
      status: 'OOS',
      department: 'QC',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
    if (!dev) return '';
    return String((dev as { deviation_number?: string }).deviation_number || dev.id || '');
  } catch {
    return '';
  }
}

async function maybeCreateOos(record: RawMaterialMonitoringRecord, actor: RawMaterialActor): Promise<string> {
  if (record.complianceStatus !== 'OOS') return '';
  try {
    const { createOosFromCpv } = await import('@/lib/oos-service');
    const oos = await createOosFromCpv({
      id: record.id,
      product: record.productName,
      batchNumber: record.batchNumber,
      parameter: record.testParameter || record.materialName,
      observedValue: Number(record.observedResult) || 0,
      lower: record.lowerLimit || 0,
      upper: record.upperLimit || 0,
      unit: record.testUnit || record.unit,
      status: 'OOS',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qc' });
    if (!oos) return '';
    return String((oos as { oos_number?: string }).oos_number || oos.id || '');
  } catch {
    return '';
  }
}

async function maybeCreateAlert(record: RawMaterialMonitoringRecord, actor: RawMaterialActor) {
  if (record.complianceStatus === 'Complies') return;
  try {
    await createAlert({
      alertType: 'Limit Exceeded',
      severity: record.riskLevel === 'Critical' ? 'Critical' : record.riskLevel === 'High' ? 'High' : 'Medium',
      module: 'Raw Material Monitoring',
      productName: record.productName,
      batchNo: record.batchNumber,
      parameterName: record.materialName,
      message: `Raw material ${record.materialName} ${record.complianceStatus} for batch ${record.batchNumber}`,
      observedValue: Number(record.observedResult) || 0,
      recordId: record.id,
    }, { id: actor.id, name: actor.name, role: actor.role });
  } catch { /* optional */ }
}

function validateUsageBlocks(data: RawMaterialMonitoringFormData, qaOverride: boolean): string | null {
  if (qaOverride) return null;
  if (isMaterialExpired(data.expDate)) return 'Material is expired — usage blocked. QA override required.';
  if (isRetestOverdue(data.retestDate)) return 'Retest date overdue — usage blocked. QA override required.';
  const avlOk = ['Approved', 'Conditional Approved', 'Conditionally Approved'].includes(data.avlStatus);
  if (!avlOk) return 'Vendor/AVL not approved — save blocked unless QA override.';
  return null;
}

export async function createRawMaterialRecord(
  data: RawMaterialMonitoringFormData,
  actor: RawMaterialActor,
  attachments: RawMaterialAttachment[] = [],
  qaOverride = false,
): Promise<{ result: RawMaterialMonitoringRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const blockErr = validateUsageBlocks(data, qaOverride);
    if (blockErr) return { result: null, error: blockErr };

    const product = await fetchCpvProductById(data.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive CPV product — entry not allowed.' };
    const batches = await fetchRmBatchesForProduct(data.productName);
    const batchMatch = batches.find((b) => b.batchNumber === data.batchNumber);
    if (batches.length && !batchMatch) return { result: null, error: 'Batch does not belong to selected product.' };
    if (batchMatch && ['Cancelled', 'Rejected'].includes(batchMatch.batchStatus)) {
      return { result: null, error: 'Cancelled or rejected batch — entry not allowed.' };
    }

    const existing = await fetchRawMaterialRecords(1000);
    const dup = existing.find((r) => r.materialCode === data.materialCode && r.arNumber === data.arNumber && !r.isDeleted);
    if (dup) return { result: null, error: 'Duplicate AR number for this material.' };

    const complianceStatus = evaluateRawMaterialCompliance({
      vendorStatus: data.vendorStatus,
      avlStatus: data.avlStatus,
      qcStatus: data.qcStatus,
      coaAvailable: data.coaAvailable,
      expDate: data.expDate,
      retestDate: data.retestDate,
      usedQuantity: data.usedQuantity,
      issuedQuantity: data.issuedQuantity,
      testParameter: data.testParameter,
      observedResult: data.observedResult,
      lowerLimit: data.lowerLimit,
      upperLimit: data.upperLimit,
    });
    const issueCount = await countMaterialIssues(data.materialCode, data.batchNumber);
    const riskLevel = evaluateRawMaterialRisk({
      expDate: data.expDate,
      retestDate: data.retestDate,
      avlStatus: data.avlStatus,
      vendorStatus: data.vendorStatus,
      qcStatus: data.qcStatus,
      coaAvailable: data.coaAvailable,
      usedQuantity: data.usedQuantity,
      issuedQuantity: data.issuedQuantity,
      complianceStatus,
    }, issueCount);

    const payload = {
      ...data,
      rawMaterialMonitoringId: buildRawMaterialMonitoringId(data.batchNumber, data.materialCode, data.arNumber),
      complianceStatus,
      riskLevel,
      capaRequired: issueCount >= 3,
      deviationRequired: data.qcStatus === 'Rejected',
      oosRequired: complianceStatus === 'OOS',
      linkedDeviationNumber: '',
      linkedOosNumber: '',
      linkedCapaNumber: '',
      reviewStatus: 'Draft' as const,
      isLocked: false,
      attachments,
      createdByName: actor.name,
      updatedByName: actor.name,
      batchNo: data.batchNumber,
      apiName: data.materialName,
      vendor: data.vendorName,
      grnNo: data.grnNumber,
      arNo: data.arNumber,
      assay: data.observedResult,
      lsl: data.lowerLimit,
      usl: data.upperLimit,
      status: complianceStatus,
    };

    const created = await createRecord(
      RAW_MATERIAL_MONITORING_COLLECTION,
      payload as Omit<RawMaterialMonitoringRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizeRawMaterialRecord(created as unknown as Record<string, unknown>);

    const devNo = await maybeCreateDeviation(result, actor);
    if (devNo) {
      const updated = await updateRecord(RAW_MATERIAL_MONITORING_COLLECTION, result.id, { linkedDeviationNumber: devNo, deviationRequired: true }, actorCtx(actor));
      if (updated) result = normalizeRawMaterialRecord(updated as unknown as Record<string, unknown>);
      await logRmAudit('deviation auto-created', result.id, actor, null, devNo, result.rawMaterialMonitoringId);
    }

    const oosNo = await maybeCreateOos(result, actor);
    if (oosNo) {
      const updated = await updateRecord(RAW_MATERIAL_MONITORING_COLLECTION, result.id, { linkedOosNumber: oosNo, oosRequired: true }, actorCtx(actor));
      if (updated) result = normalizeRawMaterialRecord(updated as unknown as Record<string, unknown>);
      await logRmAudit('OOS auto-created', result.id, actor, null, oosNo, result.rawMaterialMonitoringId);
    }

    if (complianceStatus !== 'Complies') {
      await maybeCreateAlert(result, actor);
      if (issueCount >= 3) await logRmAudit('CAPA suggested', result.id, actor, null, { material: data.materialCode }, result.rawMaterialMonitoringId);
    }

    await logRmAudit('create raw material record', result.id, actor, null, result, result.rawMaterialMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('createRawMaterialRecord failed', e);
    return { result: null, error: 'Failed to create raw material record.' };
  }
}

export async function updateRawMaterialRecord(
  id: string,
  data: Partial<RawMaterialMonitoringFormData>,
  actor: RawMaterialActor,
  existing: RawMaterialMonitoringRecord,
  attachments?: RawMaterialAttachment[],
  qaOverride = false,
): Promise<{ result: RawMaterialMonitoringRecord | null; error: string | null }> {
  if (existing.isLocked && existing.reviewStatus === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved record is locked. QA override required.' };
  }
  const merged = { ...existing, ...data } as RawMaterialMonitoringFormData & RawMaterialMonitoringRecord;
  const blockErr = validateUsageBlocks(merged, qaOverride);
  if (blockErr) return { result: null, error: blockErr };

  try {
    const complianceStatus = evaluateRawMaterialCompliance({
      vendorStatus: merged.vendorStatus,
      avlStatus: merged.avlStatus,
      qcStatus: merged.qcStatus,
      coaAvailable: merged.coaAvailable,
      expDate: merged.expDate,
      retestDate: merged.retestDate,
      usedQuantity: merged.usedQuantity,
      issuedQuantity: merged.issuedQuantity,
      testParameter: merged.testParameter,
      observedResult: merged.observedResult,
      lowerLimit: merged.lowerLimit,
      upperLimit: merged.upperLimit,
    });
    const issueCount = await countMaterialIssues(merged.materialCode, merged.batchNumber);
    const riskLevel = evaluateRawMaterialRisk({
      expDate: merged.expDate,
      retestDate: merged.retestDate,
      avlStatus: merged.avlStatus,
      vendorStatus: merged.vendorStatus,
      qcStatus: merged.qcStatus,
      coaAvailable: merged.coaAvailable,
      usedQuantity: merged.usedQuantity,
      issuedQuantity: merged.issuedQuantity,
      complianceStatus,
    }, issueCount);

    const updates: Record<string, unknown> = {
      ...data,
      complianceStatus,
      riskLevel,
      capaRequired: issueCount >= 3,
      updatedByName: actor.name,
      status: complianceStatus,
    };
    if (attachments) updates.attachments = attachments;

    const updated = await updateRecord(RAW_MATERIAL_MONITORING_COLLECTION, id, updates as Partial<RawMaterialMonitoringRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeRawMaterialRecord(updated as unknown as Record<string, unknown>);
    await logRmAudit(qaOverride ? 'QA override' : 'edit raw material record', id, actor, existing, result, result.rawMaterialMonitoringId);
    if (existing.qcStatus !== merged.qcStatus) await logRmAudit('QC status change', id, actor, existing.qcStatus, merged.qcStatus, result.rawMaterialMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('updateRawMaterialRecord failed', e);
    return { result: null, error: 'Failed to update record.' };
  }
}

export async function reviewRawMaterialRecord(id: string, actor: RawMaterialActor, existing: RawMaterialMonitoringRecord) {
  const updated = await updateRecord(RAW_MATERIAL_MONITORING_COLLECTION, id, {
    reviewStatus: 'Under Review',
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRawMaterialRecord(updated as unknown as Record<string, unknown>);
  await logRmAudit('review raw material record', id, actor, existing.reviewStatus, 'Under Review', result.rawMaterialMonitoringId);
  return { result, error: null };
}

export async function approveRawMaterialRecord(id: string, actor: RawMaterialActor, existing: RawMaterialMonitoringRecord) {
  const updated = await updateRecord(RAW_MATERIAL_MONITORING_COLLECTION, id, {
    reviewStatus: 'Approved',
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRawMaterialRecord(updated as unknown as Record<string, unknown>);
  await logRmAudit('approve raw material record', id, actor, existing.reviewStatus, 'Approved', result.rawMaterialMonitoringId);
  return { result, error: null };
}

export async function bulkCreateRawMaterialRecords(
  rows: RawMaterialMonitoringFormData[],
  actor: RawMaterialActor,
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await createRawMaterialRecord(row, actor);
    if (error) errors.push(`${row.materialName}: ${error}`);
    else created += 1;
  }
  if (created) await logRmAudit('bulk material entry', 'bulk', actor, null, { count: created });
  return { created, errors };
}

export async function importFromWarehouseReceipt(
  receiptId: string,
  cpvProductId: string,
  productName: string,
  productCode: string,
  batchNumber: string,
  usedQuantity: number,
  actor: RawMaterialActor,
): Promise<{ result: RawMaterialMonitoringRecord | null; error: string | null }> {
  const receipts = await fetchWarehouseReceiptsForImport();
  const receipt = receipts.find((r) => r.id === receiptId);
  if (!receipt) return { result: null, error: 'Warehouse receipt not found.' };

  const qcMap: Record<string, RawMaterialMonitoringFormData['qcStatus']> = {
    Approved: 'Approved',
    Rejected: 'Rejected',
    'Under Test': 'Under Test',
    Quarantine: 'Quarantine',
    'Retest Required': 'Retest Required',
    Pending: 'Under Test',
  };

  const data: RawMaterialMonitoringFormData = {
    cpvProductId,
    productName,
    productCode,
    batchNumber,
    materialCode: receipt.material_code,
    materialName: receipt.material_name,
    materialType: (receipt.material_type === 'API' ? 'API' : receipt.material_type.includes('Excipient') ? 'Excipient' : 'Raw Material') as RawMaterialMonitoringFormData['materialType'],
    materialGrade: '',
    manufacturerName: receipt.manufacturer_name || receipt.vendor_name,
    supplierName: receipt.supplier_name || receipt.vendor_name,
    vendorId: receipt.vendor_doc_id || '',
    vendorName: receipt.vendor_name,
    vendorStatus: 'Active',
    avlStatus: 'Approved',
    grnNumber: receipt.grn_number,
    arNumber: receipt.ar_number,
    coaNumber: '',
    materialLotNumber: receipt.batch_lot_number,
    mfgDate: receipt.mfg_date || new Date().toISOString().split('T')[0],
    expDate: receipt.exp_date || new Date().toISOString().split('T')[0],
    retestDate: receipt.retest_date || '',
    receivedQuantity: receipt.received_quantity,
    issuedQuantity: receipt.received_quantity,
    usedQuantity,
    unit: receipt.unit,
    storageCondition: receipt.storage_condition,
    qcStatus: qcMap[receipt.qc_status] || 'Quarantine',
    coaAvailable: receipt.coa_available ? 'Yes' : 'No',
    specificationNumber: '',
    stpNumber: '',
    testParameter: '',
    testUnit: '',
    remarks: receipt.remarks || 'Imported from warehouse receipt',
  };

  const { result, error } = await createRawMaterialRecord(data, actor);
  if (result) {
    await updateRecord(RAW_MATERIAL_MONITORING_COLLECTION, result.id, { warehouseReceiptId: receiptId }, actorCtx(actor));
  }
  return { result, error };
}

export async function fetchRawMaterialAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logRawMaterialExport(actor: RawMaterialActor, count: number) {
  await logRmAudit('export raw material list', 'export', actor, null, { count });
}

export function mapReceiptToFormPartial(receipt: Awaited<ReturnType<typeof listReceipts>>[number]) {
  return {
    materialCode: receipt.material_code,
    materialName: receipt.material_name,
    vendorName: receipt.vendor_name,
    manufacturerName: receipt.manufacturer_name,
    supplierName: receipt.supplier_name,
    grnNumber: receipt.grn_number,
    arNumber: receipt.ar_number,
    materialLotNumber: receipt.batch_lot_number,
    mfgDate: receipt.mfg_date || '',
    expDate: receipt.exp_date || '',
    retestDate: receipt.retest_date || '',
    receivedQuantity: receipt.received_quantity,
    issuedQuantity: receipt.received_quantity,
    unit: receipt.unit,
    storageCondition: receipt.storage_condition,
    coaAvailable: receipt.coa_available ? 'Yes' as const : 'No' as const,
    warehouseReceiptId: receipt.id,
  };
}
