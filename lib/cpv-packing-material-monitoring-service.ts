import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createRecord, getRecord, getRecords, updateRecord, type DocumentActor } from '@/lib/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { getPackagingMaterials } from '@/lib/packaging-service';
import type { PackagingMaterial } from '@/lib/packaging-service';
import { listReceipts } from '@/lib/warehouse-mgmt-service';
import { listVendors } from '@/lib/vendor-mgmt-service';
import { fetchCpvProductById } from '@/lib/cpv-product-master-service';
import { fetchCpvBatches } from '@/lib/cpv-batch-registration-service';
import { listCpvRecords } from '@/lib/cpv-service';
import { CPV_COLLECTIONS } from '@/lib/cpv';
import { createAlert } from '@/lib/cpv-module-service';
import {
  PACKING_MATERIAL_MONITORING_COLLECTION,
  PACKING_MODULE_NAME,
  buildPackingMaterialMonitoringId,
  calculateBalanceQuantity,
  evaluateReconciliationStatus,
  evaluatePackingCompliance,
  evaluatePackingRisk,
  isMaterialExpired,
  type PackingMaterialMonitoringFormData,
  type PackingMaterialMonitoringRecord,
  type PackingMaterialAttachment,
} from '@/lib/cpv-packing-material-monitoring';

export interface PackingMaterialActor {
  id: string;
  name: string;
  role?: string;
}

function actorCtx(actor: PackingMaterialActor) {
  return { moduleName: PACKING_MODULE_NAME, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logPmAudit(actionType: string, recordId: string, actor: PackingMaterialActor, oldVal?: unknown, newVal?: unknown, docNo?: string) {
  await createAuditLog({
    moduleName: PACKING_MODULE_NAME,
    collectionName: PACKING_MATERIAL_MONITORING_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: PACKING_MATERIAL_MONITORING_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: PACKING_MODULE_NAME,
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

function normalizePackingRecord(raw: Record<string, unknown>): PackingMaterialMonitoringRecord {
  const batchNumber = str(raw.batchNumber || raw.batchNo || raw.batch_number);
  const materialCode = str(raw.materialCode || raw.material_code, 'PM');
  const arNumber = str(raw.arNumber || raw.arNo || raw.ar_number);
  const issued = num(raw.issuedQuantity ?? raw.issued_quantity);
  const used = num(raw.usedQuantity ?? raw.used_quantity);
  const rejected = num(raw.rejectedQuantity ?? raw.rejected_quantity);
  const returned = num(raw.returnedQuantity ?? raw.returned_quantity);
  const balance = num(raw.balanceQuantity ?? raw.balance_quantity, calculateBalanceQuantity(issued, used, rejected, returned));
  const reconciliationStatus = str(raw.reconciliationStatus || raw.reconciliation_status,
    evaluateReconciliationStatus(issued, used, rejected, returned)) as PackingMaterialMonitoringRecord['reconciliationStatus'];
  const attachments = Array.isArray(raw.attachments) ? raw.attachments as PackingMaterialAttachment[] : [];

  return {
    id: str(raw.id),
    packingMaterialMonitoringId: str(raw.packingMaterialMonitoringId || raw.packing_material_monitoring_id, buildPackingMaterialMonitoringId(batchNumber, materialCode, arNumber)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    batchNumber,
    materialCode,
    materialName: str(raw.materialName || raw.material_name || raw.materialType),
    materialType: (str(raw.materialType || raw.material_type, 'Primary Packing Material') as PackingMaterialMonitoringRecord['materialType']),
    materialCategory: (str(raw.materialCategory || raw.material_category, 'Other') as PackingMaterialMonitoringRecord['materialCategory']),
    manufacturerName: str(raw.manufacturerName || raw.manufacturer_name),
    supplierName: str(raw.supplierName || raw.supplier_name),
    vendorId: str(raw.vendorId || raw.vendor_id),
    vendorName: str(raw.vendorName || raw.vendor_name || raw.vendor),
    vendorStatus: str(raw.vendorStatus || raw.vendor_status, 'Active'),
    avlStatus: str(raw.avlStatus || raw.avl_status, 'Approved'),
    grnNumber: str(raw.grnNumber || raw.grnNo || raw.grn_number),
    arNumber,
    coaNumber: str(raw.coaNumber || raw.coa_number),
    materialLotNumber: str(raw.materialLotNumber || raw.material_lot_number),
    mfgDate: str(raw.mfgDate || raw.mfg_date),
    expDate: str(raw.expDate || raw.exp_date),
    receivedQuantity: num(raw.receivedQuantity ?? raw.received_quantity),
    issuedQuantity: issued,
    usedQuantity: used,
    rejectedQuantity: rejected,
    returnedQuantity: returned,
    balanceQuantity: balance,
    unit: str(raw.unit),
    storageCondition: str(raw.storageCondition || raw.storage_condition),
    qcStatus: (str(raw.qcStatus || raw.qc_status, 'Under Test') as PackingMaterialMonitoringRecord['qcStatus']),
    coaAvailable: (str(raw.coaAvailable || raw.coa_available, 'No') as PackingMaterialMonitoringRecord['coaAvailable']),
    specificationNumber: str(raw.specificationNumber || raw.specification_number || raw.specificationNo),
    stpNumber: str(raw.stpNumber || raw.stp_number || raw.stpNo),
    testResultSummary: str(raw.testResultSummary || raw.test_result_summary || raw.testResult),
    reconciliationStatus,
    complianceStatus: str(raw.complianceStatus || raw.compliance_status || raw.status, 'Complies'),
    riskLevel: str(raw.riskLevel || raw.risk_level, 'Low'),
    deviationRequired: Boolean(raw.deviationRequired || raw.deviation_required),
    linkedDeviationNumber: str(raw.linkedDeviationNumber || raw.linked_deviation_number),
    capaRequired: Boolean(raw.capaRequired || raw.capa_required),
    linkedCapaNumber: str(raw.linkedCapaNumber || raw.linked_capa_number),
    reviewStatus: (str(raw.reviewStatus || raw.review_status, 'Draft') as PackingMaterialMonitoringRecord['reviewStatus']),
    isLocked: Boolean(raw.isLocked || raw.is_locked),
    attachments,
    warehouseReceiptId: str(raw.warehouseReceiptId || raw.warehouse_receipt_id),
    remarks: str(raw.remarks),
    createdAt: str(raw.createdAt || raw.created_at),
    updatedAt: str(raw.updatedAt || raw.updated_at),
    createdBy: str(raw.createdBy || raw.created_by),
    updatedBy: str(raw.updatedBy || raw.updated_by),
    createdByName: str(raw.createdByName),
    updatedByName: str(raw.updatedByName),
    isDeleted: Boolean(raw.isDeleted),
  };
}

export async function fetchPackingMaterialRecords(max = 500): Promise<PackingMaterialMonitoringRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: PackingMaterialMonitoringRecord[] = [];
    try {
      primary = await getRecords<PackingMaterialMonitoringRecord>(PACKING_MATERIAL_MONITORING_COLLECTION, [orderBy('createdAt', 'desc'), limit(max)]);
    } catch {
      primary = await getRecords<PackingMaterialMonitoringRecord>(PACKING_MATERIAL_MONITORING_COLLECTION, [limit(max)]);
    }
    const normalized = primary.map((r) => normalizePackingRecord(r as unknown as Record<string, unknown>));
    if (normalized.length) return normalized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const legacy = await listCpvRecords<Record<string, unknown>>(CPV_COLLECTIONS.packingMaterials, max);
    return legacy.map((r) => normalizePackingRecord(r));
  } catch (e) {
    console.error('fetchPackingMaterialRecords failed', e);
    return [];
  }
}

export async function fetchPackingMaterialRecordById(id: string): Promise<PackingMaterialMonitoringRecord | null> {
  const record = await getRecord<PackingMaterialMonitoringRecord>(PACKING_MATERIAL_MONITORING_COLLECTION, id);
  if (record) return normalizePackingRecord(record as unknown as Record<string, unknown>);
  const all = await fetchPackingMaterialRecords();
  return all.find((r) => r.id === id) ?? null;
}

export async function fetchPackingMasterOptions(): Promise<PackagingMaterial[]> {
  try {
    return await getPackagingMaterials({ status: 'Active' });
  } catch {
    return [];
  }
}

export async function fetchPackingVendorOptions() {
  try {
    return await listVendors({});
  } catch {
    return [];
  }
}

export async function fetchPackingWarehouseReceipts() {
  try {
    return await listReceipts();
  } catch {
    return [];
  }
}

export async function fetchPmBatchesForProduct(productName: string) {
  const batches = await fetchCpvBatches();
  return batches.filter((b) => b.productName === productName || b.productCode === productName);
}

async function countMaterialIssues(materialCode: string, batchNumber: string): Promise<number> {
  const results = await fetchPackingMaterialRecords(1000);
  return results.filter((r) =>
    r.materialCode === materialCode && r.batchNumber === batchNumber
    && r.complianceStatus !== 'Complies' && !r.isDeleted,
  ).length;
}

function buildComputedFields(data: PackingMaterialMonitoringFormData) {
  const balanceQuantity = calculateBalanceQuantity(
    data.issuedQuantity, data.usedQuantity, data.rejectedQuantity, data.returnedQuantity,
  );
  const reconciliationStatus = evaluateReconciliationStatus(
    data.issuedQuantity, data.usedQuantity, data.rejectedQuantity, data.returnedQuantity,
  );
  const complianceStatus = evaluatePackingCompliance({
    vendorStatus: data.vendorStatus,
    avlStatus: data.avlStatus,
    qcStatus: data.qcStatus,
    coaAvailable: data.coaAvailable,
    expDate: data.expDate,
    usedQuantity: data.usedQuantity,
    issuedQuantity: data.issuedQuantity,
    reconciliationStatus,
  });
  return { balanceQuantity, reconciliationStatus, complianceStatus };
}

async function maybeCreateDeviation(record: PackingMaterialMonitoringRecord, actor: PackingMaterialActor, reason: string): Promise<string> {
  try {
    const { createDeviationFromCpv } = await import('@/lib/deviation-service');
    const dev = await createDeviationFromCpv('cpv_cqa', {
      id: record.id,
      product: record.productName,
      batchNumber: record.batchNumber,
      parameter: record.materialName,
      observedValue: 0,
      status: record.qcStatus === 'Rejected' ? 'OOS' : 'OOT',
      department: 'QC',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
    if (!dev) return '';
    await logPmAudit('deviation auto-created', record.id, actor, null, { reason, devId: dev.id }, record.packingMaterialMonitoringId);
    return String((dev as { deviation_number?: string }).deviation_number || dev.id || '');
  } catch {
    return '';
  }
}

async function maybeCreateAlert(record: PackingMaterialMonitoringRecord, actor: PackingMaterialActor) {
  if (record.complianceStatus === 'Complies') return;
  try {
    await createAlert({
      alertType: 'Limit Exceeded',
      severity: record.riskLevel === 'Critical' ? 'Critical' : record.riskLevel === 'High' ? 'High' : 'Medium',
      module: 'Packing Material Monitoring',
      productName: record.productName,
      batchNo: record.batchNumber,
      parameterName: record.materialName,
      message: `Packing material ${record.materialName} ${record.complianceStatus} for batch ${record.batchNumber}`,
      recordId: record.id,
    }, { id: actor.id, name: actor.name, role: actor.role });
  } catch { /* optional */ }
}

function validateUsageBlocks(data: PackingMaterialMonitoringFormData, qaOverride: boolean): string | null {
  if (qaOverride) return null;
  if (isMaterialExpired(data.expDate)) return 'Material is expired — usage blocked. QA override required.';
  const avlOk = ['Approved', 'Conditional Approved', 'Conditionally Approved'].includes(data.avlStatus);
  if (!avlOk) return 'Vendor/AVL not approved — save blocked unless QA override.';
  return null;
}

export async function createPackingMaterialRecord(
  data: PackingMaterialMonitoringFormData,
  actor: PackingMaterialActor,
  attachments: PackingMaterialAttachment[] = [],
  qaOverride = false,
): Promise<{ result: PackingMaterialMonitoringRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const blockErr = validateUsageBlocks(data, qaOverride);
    if (blockErr) return { result: null, error: blockErr };

    const product = await fetchCpvProductById(data.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive CPV product — entry not allowed.' };
    const batches = await fetchPmBatchesForProduct(data.productName);
    const batchMatch = batches.find((b) => b.batchNumber === data.batchNumber);
    if (batches.length && !batchMatch) return { result: null, error: 'Batch does not belong to selected product.' };
    if (batchMatch && ['Cancelled', 'Rejected'].includes(batchMatch.batchStatus)) {
      return { result: null, error: 'Cancelled or rejected batch — entry not allowed.' };
    }

    const existing = await fetchPackingMaterialRecords(1000);
    const dup = existing.find((r) => r.materialCode === data.materialCode && r.arNumber === data.arNumber && !r.isDeleted);
    if (dup) return { result: null, error: 'Duplicate AR number for this material.' };

    const { balanceQuantity, reconciliationStatus, complianceStatus } = buildComputedFields(data);
    const issueCount = await countMaterialIssues(data.materialCode, data.batchNumber);
    const riskLevel = evaluatePackingRisk({
      expDate: data.expDate,
      avlStatus: data.avlStatus,
      qcStatus: data.qcStatus,
      coaAvailable: data.coaAvailable,
      reconciliationStatus,
      materialCategory: data.materialCategory,
      complianceStatus,
    }, issueCount);

    const deviationRequired = data.qcStatus === 'Rejected' || reconciliationStatus === 'Mismatch';
    const capaRequired = issueCount >= 3;

    const payload = {
      ...data,
      packingMaterialMonitoringId: buildPackingMaterialMonitoringId(data.batchNumber, data.materialCode, data.arNumber),
      balanceQuantity,
      reconciliationStatus,
      complianceStatus,
      riskLevel,
      capaRequired,
      deviationRequired,
      linkedDeviationNumber: '',
      linkedCapaNumber: '',
      reviewStatus: 'Draft' as const,
      isLocked: false,
      attachments,
      createdByName: actor.name,
      updatedByName: actor.name,
      batchNo: data.batchNumber,
      vendor: data.vendorName,
      grnNo: data.grnNumber,
      arNo: data.arNumber,
      materialType: data.materialType,
      testResult: data.testResultSummary,
      status: complianceStatus,
    };

    const created = await createRecord(
      PACKING_MATERIAL_MONITORING_COLLECTION,
      payload as Omit<PackingMaterialMonitoringRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizePackingRecord(created as unknown as Record<string, unknown>);

    if (deviationRequired) {
      const reason = data.qcStatus === 'Rejected' ? 'QC rejected' : 'Reconciliation mismatch';
      const devNo = await maybeCreateDeviation(result, actor, reason);
      if (devNo) {
        const updated = await updateRecord(PACKING_MATERIAL_MONITORING_COLLECTION, result.id, { linkedDeviationNumber: devNo }, actorCtx(actor));
        if (updated) result = normalizePackingRecord(updated as unknown as Record<string, unknown>);
      }
    }

    if (complianceStatus !== 'Complies') {
      await maybeCreateAlert(result, actor);
      if (capaRequired) await logPmAudit('CAPA suggested', result.id, actor, null, { material: data.materialCode }, result.packingMaterialMonitoringId);
    }

    await logPmAudit('create packing material record', result.id, actor, null, result, result.packingMaterialMonitoringId);
    await logPmAudit('reconciliation calculation', result.id, actor, null, { balanceQuantity, reconciliationStatus }, result.packingMaterialMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('createPackingMaterialRecord failed', e);
    return { result: null, error: 'Failed to create packing material record.' };
  }
}

export async function updatePackingMaterialRecord(
  id: string,
  data: Partial<PackingMaterialMonitoringFormData>,
  actor: PackingMaterialActor,
  existing: PackingMaterialMonitoringRecord,
  attachments?: PackingMaterialAttachment[],
  qaOverride = false,
): Promise<{ result: PackingMaterialMonitoringRecord | null; error: string | null }> {
  if (existing.isLocked && existing.reviewStatus === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved record is locked. QA override required.' };
  }
  const merged = { ...existing, ...data } as PackingMaterialMonitoringFormData & PackingMaterialMonitoringRecord;
  const blockErr = validateUsageBlocks(merged, qaOverride);
  if (blockErr) return { result: null, error: blockErr };

  try {
    const { balanceQuantity, reconciliationStatus, complianceStatus } = buildComputedFields(merged);
    const issueCount = await countMaterialIssues(merged.materialCode, merged.batchNumber);
    const riskLevel = evaluatePackingRisk({
      expDate: merged.expDate,
      avlStatus: merged.avlStatus,
      qcStatus: merged.qcStatus,
      coaAvailable: merged.coaAvailable,
      reconciliationStatus,
      materialCategory: merged.materialCategory,
      complianceStatus,
    }, issueCount);

    const updates: Record<string, unknown> = {
      ...data,
      balanceQuantity,
      reconciliationStatus,
      complianceStatus,
      riskLevel,
      capaRequired: issueCount >= 3,
      updatedByName: actor.name,
      status: complianceStatus,
    };
    if (attachments) updates.attachments = attachments;

    const updated = await updateRecord(PACKING_MATERIAL_MONITORING_COLLECTION, id, updates as Partial<PackingMaterialMonitoringRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizePackingRecord(updated as unknown as Record<string, unknown>);
    await logPmAudit(qaOverride ? 'QA override' : 'edit packing material record', id, actor, existing, result, result.packingMaterialMonitoringId);
    if (existing.qcStatus !== merged.qcStatus) await logPmAudit('QC status change', id, actor, existing.qcStatus, merged.qcStatus, result.packingMaterialMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('updatePackingMaterialRecord failed', e);
    return { result: null, error: 'Failed to update record.' };
  }
}

export async function reviewPackingMaterialRecord(id: string, actor: PackingMaterialActor, existing: PackingMaterialMonitoringRecord) {
  const updated = await updateRecord(PACKING_MATERIAL_MONITORING_COLLECTION, id, {
    reviewStatus: 'Under Review',
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizePackingRecord(updated as unknown as Record<string, unknown>);
  await logPmAudit('review packing material record', id, actor, existing.reviewStatus, 'Under Review', result.packingMaterialMonitoringId);
  return { result, error: null };
}

export async function approvePackingMaterialRecord(id: string, actor: PackingMaterialActor, existing: PackingMaterialMonitoringRecord) {
  const updated = await updateRecord(PACKING_MATERIAL_MONITORING_COLLECTION, id, {
    reviewStatus: 'Approved',
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizePackingRecord(updated as unknown as Record<string, unknown>);
  await logPmAudit('approve packing material record', id, actor, existing.reviewStatus, 'Approved', result.packingMaterialMonitoringId);
  return { result, error: null };
}

export async function bulkCreatePackingMaterialRecords(
  rows: PackingMaterialMonitoringFormData[],
  actor: PackingMaterialActor,
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await createPackingMaterialRecord(row, actor);
    if (error) errors.push(`${row.materialName}: ${error}`);
    else created += 1;
  }
  if (created) await logPmAudit('bulk packing material entry', 'bulk', actor, null, { count: created });
  return { created, errors };
}

export async function importPackingFromWarehouseReceipt(
  receiptId: string,
  cpvProductId: string,
  productName: string,
  productCode: string,
  batchNumber: string,
  usedQuantity: number,
  actor: PackingMaterialActor,
): Promise<{ result: PackingMaterialMonitoringRecord | null; error: string | null }> {
  const receipts = await fetchPackingWarehouseReceipts();
  const receipt = receipts.find((r) => r.id === receiptId);
  if (!receipt) return { result: null, error: 'Warehouse receipt not found.' };

  const qcMap: Record<string, PackingMaterialMonitoringFormData['qcStatus']> = {
    Approved: 'Approved', Rejected: 'Rejected', 'Under Test': 'Under Test',
    Quarantine: 'Quarantine', 'Retest Required': 'Retest Required', Pending: 'Under Test',
  };

  const matType = receipt.material_type.includes('Primary') ? 'Primary Packing Material'
    : receipt.material_type.includes('Secondary') ? 'Secondary Packing Material'
      : receipt.material_type.includes('Tertiary') ? 'Tertiary Packing Material'
        : 'Primary Packing Material';

  const data: PackingMaterialMonitoringFormData = {
    cpvProductId,
    productName,
    productCode,
    batchNumber,
    materialCode: receipt.material_code,
    materialName: receipt.material_name,
    materialType: matType as PackingMaterialMonitoringFormData['materialType'],
    materialCategory: 'Other',
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
    receivedQuantity: receipt.received_quantity,
    issuedQuantity: receipt.received_quantity,
    usedQuantity,
    rejectedQuantity: 0,
    returnedQuantity: 0,
    unit: receipt.unit,
    storageCondition: receipt.storage_condition,
    qcStatus: qcMap[receipt.qc_status] || 'Quarantine',
    coaAvailable: receipt.coa_available ? 'Yes' : 'No',
    specificationNumber: '',
    stpNumber: '',
    testResultSummary: '',
    remarks: receipt.remarks || 'Imported from warehouse receipt',
  };

  const { result, error } = await createPackingMaterialRecord(data, actor);
  if (result) {
    await updateRecord(PACKING_MATERIAL_MONITORING_COLLECTION, result.id, { warehouseReceiptId: receiptId }, actorCtx(actor));
  }
  return { result, error };
}

export async function fetchPackingMaterialAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logPackingMaterialExport(actor: PackingMaterialActor, count: number) {
  await logPmAudit('export packing material list', 'export', actor, null, { count });
}

export function mapPackagingType(pmType: string): PackingMaterialMonitoringFormData['materialType'] {
  if (pmType.includes('Primary')) return 'Primary Packing Material';
  if (pmType.includes('Secondary')) return 'Secondary Packing Material';
  if (pmType.includes('Tertiary')) return 'Tertiary Packing Material';
  return 'Primary Packing Material';
}

export function mapPackagingCategory(category: string): PackingMaterialMonitoringFormData['materialCategory'] {
  const map: Record<string, PackingMaterialMonitoringFormData['materialCategory']> = {
    Vial: 'Vial', Label: 'Label', Carton: 'Carton', 'Rubber Stopper': 'Rubber Stopper',
    'Flip Off Seal': 'Flip Off Seal', 'Package Insert / Leaflet': 'Package Insert / Leaflet',
    'Shipper Box': 'Shipper Box', 'PVC Film': 'PVC Film', 'BOPP Tape': 'BOPP Tape',
  };
  return map[category] || 'Other';
}
