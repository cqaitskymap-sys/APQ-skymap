import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage, isFirebaseConfigured } from '@/lib/firebase';
import { writeAuditTrail } from '@/lib/audit-trail';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS, BATCH_ATTACHMENT_MAX_BYTES } from './constants';
import { fetchProducts } from './product-service';
import type { AdminBatch, BatchFormData, BatchAttachment, AdminProduct } from './schemas';
import { canQaOverrideBatch } from '@/lib/permissions';

export interface BatchAuditMeta {
  userId: string;
  userName: string;
}

async function logBatchAudit(
  action: string,
  recordId: string,
  meta: BatchAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Batch Master',
    recordId,
    action,
    oldValue: typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue ?? ''),
    newValue: typeof newValue === 'string' ? newValue : JSON.stringify(newValue ?? ''),
    reason: '',
    ipAddress: 'client',
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
    status: 'Success',
  });

  await writeAuditTrail({
    collectionName: ADMIN_COLLECTIONS.batches,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Batch Master',
  });
}

export function buildBatchId(batchNumber: string): string {
  return `BATCH-${batchNumber.toUpperCase().replace(/\s+/g, '-')}`;
}

export function normalizeBatch(b: AdminBatch): AdminBatch {
  return {
    ...b,
    batchSizeUnit: b.batchSizeUnit || b.unit || 'Vials',
    unit: b.batchSizeUnit || b.unit || 'Vials',
    manufacturingLine: b.manufacturingLine || b.lineNumber || '',
    lineNumber: b.manufacturingLine || b.lineNumber || '',
    batchSize: String(b.batchSize ?? ''),
    status: b.batchStatus === 'Released' ? 'Active' : b.status,
  };
}

export function productToBatchAutofill(product: AdminProduct): Partial<BatchFormData> {
  return {
    productCode: product.productCode,
    productName: product.productName,
    genericName: product.genericName || '',
    strength: product.strength || '',
    dosageForm: product.dosageForm || '',
    market: product.market || '',
    batchSize: Number(product.standardBatchSize || product.batchSize) || undefined,
    mfrNumber: product.mfrNumber || '',
    bmrNumber: product.bmrNumber || '',
    bprNumber: product.bprNumber || '',
  };
}

export async function fetchBatches(): Promise<AdminBatch[]> {
  try {
    const records = await getAdminRecords<AdminBatch>(ADMIN_COLLECTIONS.batches);
    return records.filter((b) => !b.isDeleted).map(normalizeBatch);
  } catch {
    return [];
  }
}

export async function fetchBatchById(id: string): Promise<AdminBatch | null> {
  const batches = await fetchBatches();
  return batches.find((b) => b.id === id) ?? null;
}

export async function fetchBatchAttachments(batchId: string): Promise<BatchAttachment[]> {
  try {
    const all = await getAdminRecords<BatchAttachment>(ADMIN_COLLECTIONS.batchAttachments);
    return all.filter((a) => a.batchId === batchId && !(a as { isDeleted?: boolean }).isDeleted);
  } catch {
    return [];
  }
}

export function getBatchSummaryCounts(batches: AdminBatch[]) {
  const count = (status: string) => batches.filter((b) => b.batchStatus === status).length;
  return {
    total: batches.length,
    planned: count('Planned'),
    manufacturing: count('Manufacturing'),
    qcTesting: count('Under QC Testing'),
    qaReview: count('Under QA Review'),
    released: count('Released'),
    rejected: count('Rejected'),
    hold: count('Hold'),
  };
}

export function isBatchReleasedLocked(batch: AdminBatch): boolean {
  return batch.batchStatus === 'Released';
}

function formToPayload(data: BatchFormData, meta: BatchAuditMeta) {
  const batchId = buildBatchId(data.batchNumber);
  return {
    batchId,
    batchNumber: data.batchNumber,
    productCode: data.productCode,
    productName: data.productName,
    genericName: data.genericName,
    strength: data.strength,
    dosageForm: data.dosageForm,
    market: data.market,
    batchSize: String(data.batchSize),
    batchSizeUnit: data.batchSizeUnit,
    unit: data.batchSizeUnit,
    manufacturingDate: data.manufacturingDate,
    expiryDate: data.expiryDate,
    manufacturingSite: data.manufacturingSite,
    manufacturingLine: data.manufacturingLine,
    lineNumber: data.manufacturingLine,
    shift: data.shift,
    mfrNumber: data.mfrNumber,
    bmrNumber: data.bmrNumber,
    bprNumber: data.bprNumber,
    manufacturedFor: data.manufacturedFor,
    customerName: data.customerName,
    batchStatus: data.batchStatus,
    releaseStatus: data.releaseStatus,
    releaseDate: data.releaseDate,
    qaReleasedBy: data.qaReleasedBy,
    semiFinishedBatchNumber: data.semiFinishedBatchNumber,
    finishedProductBatchNumber: data.finishedProductBatchNumber,
    packingBatchNumber: data.packingBatchNumber,
    statusChangeReason: data.statusChangeReason,
    remarks: data.remarks,
    status: data.batchStatus === 'Released' ? 'Active' : 'Inactive',
    createdBy: meta.userId,
    updatedBy: meta.userId,
  };
}

export async function createBatch(
  data: BatchFormData,
  meta: BatchAuditMeta,
): Promise<{ batch: AdminBatch | null; error: string | null }> {
  try {
    const unique = await checkUniqueField(ADMIN_COLLECTIONS.batches, 'batchNumber', data.batchNumber);
    if (!unique) return { batch: null, error: 'Batch number already exists' };

    const products = await fetchProducts();
    const product = products.find((p) => p.productCode === data.productCode);
    if (!product) return { batch: null, error: 'Product not found' };
    if (product.productStatus !== 'Active') {
      return { batch: null, error: 'Cannot create batch for inactive product' };
    }

    const payload = formToPayload({ ...data, ...productToBatchAutofill(product) as BatchFormData }, meta);
    const created = await createAdminRecord(ADMIN_COLLECTIONS.batches, payload as Omit<AdminBatch, 'id'>, {
      userId: meta.userId, userName: meta.userName, module: 'Batch Master', action: 'CREATE_BATCH',
    });

    await logBatchAudit('CREATE_BATCH', created.id || payload.batchId, meta, null, payload);
    return { batch: normalizeBatch(created as AdminBatch), error: null };
  } catch (e) {
    return { batch: null, error: (e as Error).message };
  }
}

export async function updateBatch(
  id: string,
  data: BatchFormData,
  existing: AdminBatch,
  meta: BatchAuditMeta,
  currentRole: string,
): Promise<{ batch: AdminBatch | null; error: string | null }> {
  try {
    if (isBatchReleasedLocked(existing) && !data.qaOverride && !canQaOverrideBatch(currentRole)) {
      return { batch: null, error: 'Released batch cannot be edited without QA override' };
    }

    if (data.batchNumber !== existing.batchNumber) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.batches, 'batchNumber', data.batchNumber, id);
      if (!unique) return { batch: null, error: 'Batch number already exists' };
    }

    const updates = formToPayload(data, meta);
    delete (updates as { createdBy?: string }).createdBy;

    if (data.qaOverride && isBatchReleasedLocked(existing)) {
      await logBatchAudit('QA_OVERRIDE', id, meta, existing, updates);
    }

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.batches, id, updates, {
      userId: meta.userId, userName: meta.userName, module: 'Batch Master',
      oldValue: JSON.stringify(existing),
    });

    if (existing.batchStatus !== data.batchStatus) {
      await logBatchAudit('STATUS_CHANGE', id, meta, existing.batchStatus, data.batchStatus);
    }
    await logBatchAudit('EDIT_BATCH', id, meta, existing, updates);
    return { batch: normalizeBatch(updated as AdminBatch), error: null };
  } catch (e) {
    return { batch: null, error: (e as Error).message };
  }
}

export async function setBatchStatusAction(
  id: string,
  batch: AdminBatch,
  action: 'release' | 'reject' | 'hold',
  reason: string,
  meta: BatchAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  const statusMap = {
    release: { batchStatus: 'Released' as const, releaseStatus: 'Released' as const },
    reject: { batchStatus: 'Rejected' as const, releaseStatus: 'Rejected' as const },
    hold: { batchStatus: 'Hold' as const, releaseStatus: 'On Hold' as const },
  };
  const patch = statusMap[action];
  if (!reason.trim()) return { success: false, error: 'Reason is required' };

  try {
    const updates: Partial<AdminBatch> = {
      ...patch,
      statusChangeReason: reason,
      releaseDate: action === 'release' ? new Date().toISOString().split('T')[0] : batch.releaseDate,
      qaReleasedBy: action === 'release' ? meta.userName : batch.qaReleasedBy,
      status: action === 'release' ? 'Active' : 'Inactive',
    };

    await updateAdminRecord(ADMIN_COLLECTIONS.batches, id, updates, {
      userId: meta.userId, userName: meta.userName, module: 'Batch Master',
      oldValue: JSON.stringify(batch),
    });

    const auditAction = action === 'release' ? 'RELEASE_BATCH' : action === 'reject' ? 'REJECT_BATCH' : 'HOLD_BATCH';
    await logBatchAudit(auditAction, id, meta, batch.batchStatus, { ...patch, reason });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function uploadBatchAttachment(
  batchId: string,
  file: File,
  meta: BatchAuditMeta,
): Promise<{ attachment: BatchAttachment | null; error?: string }> {
  if (file.size > BATCH_ATTACHMENT_MAX_BYTES) {
    return { attachment: null, error: 'File must be 10 MB or smaller' };
  }
  if (!isFirebaseConfigured()) {
    return { attachment: null, error: 'Firebase Storage is not configured' };
  }

  try {
    const path = `batches/${batchId}/attachments/${Date.now()}_${file.name}`;
    const storageRef = ref(getFirebaseStorage(), path);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    const payload: Omit<BatchAttachment, 'id'> = {
      batchId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storagePath: path,
      downloadUrl,
      uploadedBy: meta.userId,
    };

    const created = await createAdminRecord(ADMIN_COLLECTIONS.batchAttachments, payload as Record<string, unknown>, {
      userId: meta.userId, userName: meta.userName, module: 'Batch Master', action: 'ATTACHMENT_UPLOAD',
    });

    await logBatchAudit('ATTACHMENT_UPLOAD', batchId, meta, null, { fileName: file.name });
    return { attachment: created as BatchAttachment };
  } catch (e) {
    return { attachment: null, error: (e as Error).message };
  }
}

export async function deleteBatchAttachment(
  attachment: BatchAttachment,
  meta: BatchAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (attachment.storagePath && isFirebaseConfigured()) {
      try { await deleteObject(ref(getFirebaseStorage(), attachment.storagePath)); } catch { /* ignore */ }
    }
    if (attachment.id) {
      await updateAdminRecord(ADMIN_COLLECTIONS.batchAttachments, attachment.id, { isDeleted: true }, {
        userId: meta.userId, userName: meta.userName, module: 'Batch Master',
        oldValue: JSON.stringify(attachment),
      });
    }
    await logBatchAudit('ATTACHMENT_DELETE', attachment.batchId, meta, attachment, null);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function fetchBatchAuditTrail(recordId: string) {
  try {
    const [trail, logs] = await Promise.all([
      getAdminRecords<Record<string, unknown>>(ADMIN_COLLECTIONS.auditTrail).catch(() => []),
      getAdminRecords<Record<string, unknown>>(ADMIN_COLLECTIONS.auditLogs).catch(() => []),
    ]);
    return [...trail, ...logs]
      .filter((l) => l.documentId === recordId || l.recordId === recordId)
      .sort((a, b) => String(b.timestamp ?? b.dateTime).localeCompare(String(a.timestamp ?? a.dateTime)))
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function exportBatchesCsv(batches: AdminBatch[]): string {
  const headers = [
    'Batch ID', 'Batch Number', 'Product Code', 'Product Name', 'Batch Size',
    'Mfg Date', 'Expiry', 'Batch Status', 'Release Status',
  ];
  const rows = batches.map((b) => [
    b.batchId, b.batchNumber, b.productCode, b.productName, b.batchSize,
    b.manufacturingDate, b.expiryDate, b.batchStatus, b.releaseStatus,
  ]);
  return [headers.join(','), ...rows.map((row) =>
    row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','),
  )].join('\n');
}

export async function logBatchExport(meta: BatchAuditMeta, count: number) {
  await logBatchAudit('EXPORT_BATCH_LIST', 'export', meta, null, { count });
}

export async function importBatchesFromFile(
  file: File,
  meta: BatchAuditMeta,
): Promise<{ imported: number; errors: string[] }> {
  const text = await file.text();
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { imported: 0, errors: ['No data rows found'] };

  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const idx = (name: string) => headers.findIndex((h) => h.includes(name));

  let imported = 0;
  const errors: string[] = [];

  for (const line of lines.slice(1)) {
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];
    const batchNumber = cols[idx('batch number')] || cols[idx('batch')] || '';
    const productCode = cols[idx('product code')] || cols[idx('product')] || '';
    if (!batchNumber || !productCode) {
      errors.push(`Row missing batch/product: ${line.slice(0, 40)}`);
      continue;
    }

    const data: BatchFormData = {
      batchNumber,
      productCode,
      productName: cols[idx('product name')] || '',
      genericName: '',
      strength: cols[idx('strength')] || '',
      dosageForm: 'Other',
      market: 'Domestic',
      batchSize: Number(cols[idx('batch size')] || 1),
      batchSizeUnit: 'Vials',
      manufacturingDate: cols[idx('manufacturing')] || new Date().toISOString().split('T')[0],
      expiryDate: cols[idx('expiry')] || new Date().toISOString().split('T')[0],
      manufacturingSite: '',
      manufacturingLine: '',
      shift: '',
      mfrNumber: '',
      bmrNumber: '',
      bprNumber: '',
      manufacturedFor: '',
      customerName: cols[idx('customer')] || '',
      batchStatus: 'Planned',
      releaseStatus: 'Pending',
      releaseDate: '',
      qaReleasedBy: '',
      semiFinishedBatchNumber: '',
      finishedProductBatchNumber: '',
      packingBatchNumber: '',
      statusChangeReason: '',
      remarks: 'Imported',
    };

    const result = await createBatch(data, meta);
    if (result.error) errors.push(`${batchNumber}: ${result.error}`);
    else imported += 1;
  }

  if (imported) await logBatchAudit('IMPORT_BATCH', 'import', meta, null, { imported, errors: errors.length });
  return { imported, errors };
}
