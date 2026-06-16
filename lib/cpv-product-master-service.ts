import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  createRecord,
  getRecord,
  getRecords,
  updateRecord,
  type DocumentActor,
} from '@/lib/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { fetchProducts, normalizeProduct } from '@/lib/admin/product-service';
import { fetchParameters, normalizeParameter } from '@/lib/admin/parameter-service';
import type { AdminProduct, Parameter } from '@/lib/admin/schemas';
import {
  CPV_PRODUCT_COLLECTION,
  CPV_PRODUCT_MODULE,
  buildCpvProductId,
  computeNextReviewDueDate,
  isCpvProductOperational,
  type CpvProductFormData,
  type CpvProductRecord,
  type LinkedParameterRow,
} from '@/lib/cpv-product-master';

const LEGACY_COLLECTION = 'cpv_config_products';
const MODULE_NAME = CPV_PRODUCT_MODULE;

export interface CpvProductActor {
  id: string;
  name: string;
}

function actorContext(actor: CpvProductActor) {
  return {
    moduleName: MODULE_NAME,
    actor: { id: actor.id, name: actor.name } as DocumentActor,
  };
}

async function logCpvProductAudit(
  actionType: string,
  recordId: string,
  actor: CpvProductActor,
  oldValue?: unknown,
  newValue?: unknown,
  documentNumber?: string,
) {
  await createAuditLog({
    moduleName: MODULE_NAME,
    collectionName: CPV_PRODUCT_COLLECTION,
    recordId,
    documentNumber,
    actionType,
    oldValue,
    newValue,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });

  await writeAuditTrail({
    collectionName: CPV_PRODUCT_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue,
    newValue,
    userId: actor.id,
    userName: actor.name,
    moduleName: MODULE_NAME,
  });
}

function str(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function normalizeCpvProduct(raw: Record<string, unknown>): CpvProductRecord {
  const productCode = str(raw.productCode);
  return {
    id: str(raw.id),
    cpvProductId: str(raw.cpvProductId, buildCpvProductId(productCode)),
    adminProductId: str(raw.adminProductId || raw.productId),
    productCode,
    productName: str(raw.productName),
    genericName: str(raw.genericName),
    brandName: str(raw.brandName),
    strength: str(raw.strength),
    dosageForm: str(raw.dosageForm),
    routeOfAdministration: str(raw.routeOfAdministration || raw.route),
    packSize: str(raw.packSize),
    market: str(raw.market),
    shelfLife: str(raw.shelfLife),
    storageCondition: str(raw.storageCondition),
    standardBatchSize: str(raw.standardBatchSize || raw.batchSize),
    manufacturingLicenseNumber: str(
      raw.manufacturingLicenseNumber || raw.manufacturingLicenseNo,
    ),
    mfrNumber: str(raw.mfrNumber),
    bmrNumber: str(raw.bmrNumber),
    bprNumber: str(raw.bprNumber),
    specificationNumber: str(raw.specificationNumber),
    stpNumber: str(raw.stpNumber),
    cpvStatus: (str(raw.cpvStatus || raw.status, 'Active') as CpvProductRecord['cpvStatus']),
    cpvStartDate: str(raw.cpvStartDate),
    cpvReviewFrequency: (str(raw.cpvReviewFrequency, 'Yearly') as CpvProductRecord['cpvReviewFrequency']),
    cpvOwner: str(raw.cpvOwner),
    qaReviewer: str(raw.qaReviewer),
    remarks: str(raw.remarks),
    linkedCppParameterIds: Array.isArray(raw.linkedCppParameterIds)
      ? raw.linkedCppParameterIds.map(String)
      : [],
    linkedCqaParameterIds: Array.isArray(raw.linkedCqaParameterIds)
      ? raw.linkedCqaParameterIds.map(String)
      : [],
    nextReviewDueDate: str(raw.nextReviewDueDate),
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
    createdBy: str(raw.createdBy),
    updatedBy: str(raw.updatedBy),
    createdByName: str(raw.createdByName),
    updatedByName: str(raw.updatedByName),
    isDeleted: Boolean(raw.isDeleted),
    status: str(raw.status || raw.cpvStatus),
  };
}

export function adminProductToCpvAutofill(product: AdminProduct): Partial<CpvProductFormData> {
  const p = normalizeProduct(product);
  return {
    adminProductId: p.id || '',
    productCode: p.productCode,
    productName: p.productName,
    genericName: p.genericName || '',
    brandName: p.brandName || '',
    strength: p.strength || '',
    dosageForm: p.dosageForm || '',
    routeOfAdministration: p.routeOfAdministration || '',
    packSize: p.packSize || '',
    market: p.market || '',
    shelfLife: p.shelfLife || '',
    storageCondition: p.storageCondition || '',
    standardBatchSize: p.standardBatchSize || p.batchSize || '',
    manufacturingLicenseNumber: p.manufacturingLicenseNumber || p.manufacturingLicenseNo || '',
    mfrNumber: p.mfrNumber || '',
    bmrNumber: p.bmrNumber || '',
    bprNumber: p.bprNumber || '',
    specificationNumber: p.specificationNumber || '',
    stpNumber: p.stpNumber || '',
    remarks: p.remarks || '',
  };
}

export function parameterToLinkedRow(p: Parameter): LinkedParameterRow {
  const n = normalizeParameter(p);
  return {
    id: n.id || '',
    parameterCode: n.parameterCode,
    parameterName: n.parameterName,
    parameterType: n.parameterType,
    processStage: n.processStage || '',
    lsl: n.lsl || n.lowerLimit || '',
    usl: n.usl || n.upperLimit || '',
    target: n.target || n.targetValue || '',
    unit: n.unit || '',
    criticality: n.criticality || '',
    status: n.status || 'Active',
  };
}

async function safeQueryCollection(name: string, max = 300): Promise<Record<string, unknown>[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), name),
      orderBy('createdAt', 'desc'),
      limit(max),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), name), limit(max)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn(`CPV product master: unable to load ${name}`, e);
      return [];
    }
  }
}

export async function fetchCpvProducts(): Promise<CpvProductRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const primary = await getRecords<CpvProductRecord>(CPV_PRODUCT_COLLECTION);
    const normalized = primary.map((r) => normalizeCpvProduct(r as unknown as Record<string, unknown>));
    if (normalized.length > 0) return normalized;

    const legacy = await safeQueryCollection(LEGACY_COLLECTION);
    return legacy.map((r) => normalizeCpvProduct({
      ...r,
      cpvStatus: r.status === 'Inactive' ? 'Inactive' : 'Active',
      cpvStartDate: r.cpvStartDate || r.createdAt || new Date().toISOString().split('T')[0],
      cpvReviewFrequency: 'Yearly',
      cpvOwner: r.cpvOwner || 'QA',
      linkedCppParameterIds: [],
      linkedCqaParameterIds: [],
    }));
  } catch (e) {
    console.error('fetchCpvProducts failed', e);
    return [];
  }
}

export async function fetchCpvProductById(id: string): Promise<CpvProductRecord | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const record = await getRecord<CpvProductRecord>(CPV_PRODUCT_COLLECTION, id);
    if (!record) {
      const all = await fetchCpvProducts();
      return all.find((p) => p.id === id) ?? null;
    }
    return normalizeCpvProduct(record as unknown as Record<string, unknown>);
  } catch (e) {
    console.error('fetchCpvProductById failed', e);
    return null;
  }
}

export async function isDuplicateActiveCpvProductCode(
  productCode: string,
  excludeId?: string,
): Promise<boolean> {
  const products = await fetchCpvProducts();
  return products.some((p) => {
    if (excludeId && p.id === excludeId) return false;
    if (p.productCode.toLowerCase() !== productCode.toLowerCase()) return false;
    return p.cpvStatus === 'Active' || p.cpvStatus === 'Under Review';
  });
}

export async function fetchAdminProductsForImport(): Promise<AdminProduct[]> {
  try {
    return await fetchProducts();
  } catch {
    return [];
  }
}

export async function fetchActiveParametersByType(type: 'CPP' | 'CQA'): Promise<Parameter[]> {
  try {
    const all = await fetchParameters();
    return all.filter((p) => {
      const n = normalizeParameter(p);
      const pt = n.parameterType?.toUpperCase();
      return pt === type && n.status === 'Active' && !n.isDeleted;
    });
  } catch {
    return [];
  }
}

export async function fetchLinkedParameters(ids: string[]): Promise<LinkedParameterRow[]> {
  if (!ids.length) return [];
  try {
    const all = await fetchParameters();
    const map = new Map(all.map((p) => [p.id, parameterToLinkedRow(p)]));
    return ids.map((id) => map.get(id)).filter(Boolean) as LinkedParameterRow[];
  } catch {
    return [];
  }
}

export async function fetchProductBatches(product: CpvProductRecord): Promise<Record<string, unknown>[]> {
  const names = [product.productName, product.productCode].filter(Boolean);
  const collections = ['batches', 'cpv_batches'];
  const merged: Record<string, unknown>[] = [];
  for (const col of collections) {
    const rows = await safeQueryCollection(col, 100);
    merged.push(...rows.filter((r) => {
      const pn = str(r.productName || r.product_name || r.product);
      const pc = str(r.productCode || r.product_code);
      return names.some((n) => pn === n || pc === n);
    }));
  }
  return merged.slice(0, 50);
}

export async function fetchProductCpvReviews(product: CpvProductRecord): Promise<Record<string, unknown>[]> {
  const names = [product.productName, product.productCode].filter(Boolean);
  const collections = ['cpv_reviews', 'cpv_annual_review'];
  const merged: Record<string, unknown>[] = [];
  for (const col of collections) {
    const rows = await safeQueryCollection(col, 50);
    merged.push(...rows.filter((r) => {
      const pn = str(r.productName || r.product_name || r.product);
      return names.some((n) => pn === n);
    }));
  }
  return merged;
}

export async function fetchProductAuditTrail(recordId: string): Promise<Record<string, unknown>[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), 'audit_trail'),
      where('documentId', '==', recordId),
      limit(50),
    ));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (rows.length) return rows;
    const snap2 = await getDocs(query(
      collection(getFirebaseFirestore(), 'audit_trail'),
      where('recordId', '==', recordId),
      limit(50),
    ));
    return snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const fallback = await safeQueryCollection('audit_trail', 100);
    return fallback.filter((r) => str(r.documentId || r.recordId) === recordId);
  }
}

export async function createCpvProduct(
  data: CpvProductFormData,
  actor: CpvProductActor,
): Promise<{ product: CpvProductRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) {
    return { product: null, error: 'Firebase is not configured.' };
  }
  try {
    if (await isDuplicateActiveCpvProductCode(data.productCode)) {
      return { product: null, error: 'An active CPV product with this code already exists.' };
    }
    const nextReviewDueDate = computeNextReviewDueDate(data.cpvStartDate, data.cpvReviewFrequency);
    const payload = {
      ...data,
      cpvProductId: buildCpvProductId(data.productCode),
      nextReviewDueDate,
      status: data.cpvStatus,
      createdByName: actor.name,
      updatedByName: actor.name,
    };
    const created = await createRecord(
      CPV_PRODUCT_COLLECTION,
      payload as Omit<CpvProductRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorContext(actor),
    );
    const product = normalizeCpvProduct(created as unknown as Record<string, unknown>);
    await logCpvProductAudit('create CPV product', product.id, actor, null, product, product.cpvProductId);
    return { product, error: null };
  } catch (e) {
    console.error('createCpvProduct failed', e);
    return { product: null, error: 'Failed to create CPV product.' };
  }
}

export async function updateCpvProduct(
  id: string,
  data: Partial<CpvProductFormData>,
  actor: CpvProductActor,
  existing: CpvProductRecord,
): Promise<{ product: CpvProductRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) {
    return { product: null, error: 'Firebase is not configured.' };
  }
  try {
    if (data.productCode && await isDuplicateActiveCpvProductCode(data.productCode, id)) {
      return { product: null, error: 'An active CPV product with this code already exists.' };
    }
    const cpvStartDate = data.cpvStartDate ?? existing.cpvStartDate;
    const frequency = data.cpvReviewFrequency ?? existing.cpvReviewFrequency;
    const nextReviewDueDate = computeNextReviewDueDate(cpvStartDate, frequency);
    const updates = {
      ...data,
      nextReviewDueDate,
      status: data.cpvStatus ?? existing.cpvStatus,
      updatedByName: actor.name,
    };
    const updated = await updateRecord(
      CPV_PRODUCT_COLLECTION,
      id,
      updates as Partial<CpvProductRecord>,
      actorContext(actor),
    );
    if (!updated) return { product: null, error: 'Product not found.' };
    const product = normalizeCpvProduct(updated as unknown as Record<string, unknown>);
    await logCpvProductAudit('edit CPV product', id, actor, existing, product, product.cpvProductId);
    return { product, error: null };
  } catch (e) {
    console.error('updateCpvProduct failed', e);
    return { product: null, error: 'Failed to update CPV product.' };
  }
}

export async function setCpvProductStatus(
  id: string,
  cpvStatus: CpvProductRecord['cpvStatus'],
  actor: CpvProductActor,
  existing: CpvProductRecord,
): Promise<{ product: CpvProductRecord | null; error: string | null }> {
  const action = cpvStatus === 'Active' ? 'activate product' : 'deactivate product';
  const result = await updateCpvProduct(id, { cpvStatus }, actor, existing);
  if (result.product) {
    await logCpvProductAudit(action, id, actor, existing.cpvStatus, cpvStatus, existing.cpvProductId);
  }
  return result;
}

export async function linkCpvParameter(
  productId: string,
  parameterId: string,
  type: 'CPP' | 'CQA',
  actor: CpvProductActor,
  existing: CpvProductRecord,
): Promise<{ product: CpvProductRecord | null; error: string | null }> {
  const field = type === 'CPP' ? 'linkedCppParameterIds' : 'linkedCqaParameterIds';
  const current = existing[field] || [];
  if (current.includes(parameterId)) {
    return { product: existing, error: null };
  }
  const updates = { [field]: [...current, parameterId] };
  const result = await updateCpvProduct(productId, updates, actor, existing);
  if (result.product) {
    await logCpvProductAudit(
      type === 'CPP' ? 'link CPP parameter' : 'link CQA parameter',
      productId,
      actor,
      current,
      updates[field],
      existing.cpvProductId,
    );
  }
  return result;
}

export async function unlinkCpvParameter(
  productId: string,
  parameterId: string,
  type: 'CPP' | 'CQA',
  actor: CpvProductActor,
  existing: CpvProductRecord,
): Promise<{ product: CpvProductRecord | null; error: string | null }> {
  const field = type === 'CPP' ? 'linkedCppParameterIds' : 'linkedCqaParameterIds';
  const current = existing[field] || [];
  const updates = { [field]: current.filter((id) => id !== parameterId) };
  const result = await updateCpvProduct(productId, updates, actor, existing);
  if (result.product) {
    await logCpvProductAudit(
      type === 'CPP' ? 'unlink CPP parameter' : 'unlink CQA parameter',
      productId,
      actor,
      current,
      updates[field],
      existing.cpvProductId,
    );
  }
  return result;
}

export async function importCpvProductFromAdmin(
  adminProductId: string,
  cpvFields: Pick<CpvProductFormData, 'cpvStartDate' | 'cpvReviewFrequency' | 'cpvOwner' | 'qaReviewer' | 'cpvStatus' | 'remarks'>,
  actor: CpvProductActor,
): Promise<{ product: CpvProductRecord | null; error: string | null }> {
  const products = await fetchAdminProductsForImport();
  const adminProduct = products.find((p) => p.id === adminProductId);
  if (!adminProduct) return { product: null, error: 'Admin product not found.' };

  const autofill = adminProductToCpvAutofill(adminProduct);
  const data: CpvProductFormData = {
    ...autofill,
    adminProductId,
    productCode: autofill.productCode || '',
    productName: autofill.productName || '',
    strength: autofill.strength || '',
    dosageForm: autofill.dosageForm || '',
    cpvStartDate: cpvFields.cpvStartDate,
    cpvReviewFrequency: cpvFields.cpvReviewFrequency,
    cpvOwner: cpvFields.cpvOwner,
    qaReviewer: cpvFields.qaReviewer || '',
    cpvStatus: cpvFields.cpvStatus || 'Active',
    remarks: cpvFields.remarks || '',
    linkedCppParameterIds: [],
    linkedCqaParameterIds: [],
  } as CpvProductFormData;

  const result = await createCpvProduct(data, actor);
  if (result.product) {
    await logCpvProductAudit(
      'import from Product Master',
      result.product.id,
      actor,
      null,
      { adminProductId, productCode: data.productCode },
      result.product.cpvProductId,
    );
  }
  return result;
}

export function exportCpvProductsCsvPlaceholder(products: CpvProductRecord[]): string {
  const headers = ['CPV Product ID', 'Product Code', 'Product Name', 'Strength', 'Dosage Form', 'CPV Status', 'Review Frequency', 'Owner'];
  const rows = products.map((p) => [
    p.cpvProductId,
    p.productCode,
    p.productName,
    p.strength,
    p.dosageForm,
    p.cpvStatus,
    p.cpvReviewFrequency,
    p.cpvOwner,
  ]);
  return [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export async function logCpvProductExport(actor: CpvProductActor, count: number): Promise<void> {
  await logCpvProductAudit('export CPV product list', 'export', actor, null, { count });
}

export async function isCpvProductActiveForEntry(productCodeOrName: string): Promise<boolean> {
  if (!productCodeOrName) return true;
  const products = await fetchCpvProducts();
  const match = products.find((p) =>
    p.productCode.toLowerCase() === productCodeOrName.toLowerCase()
    || p.productName.toLowerCase() === productCodeOrName.toLowerCase(),
  );
  if (!match) return true;
  return isCpvProductOperational(match.cpvStatus);
}

export async function fetchCppCqaParameterCollections(
  product: CpvProductRecord,
): Promise<{ cpp: Record<string, unknown>[]; cqa: Record<string, unknown>[] }> {
  const names = [product.productName, product.productCode].filter(Boolean);
  const cppRows = await safeQueryCollection('cpp_parameters', 200);
  const cqaRows = await safeQueryCollection('cqa_parameters', 200);
  const matchProduct = (r: Record<string, unknown>) => {
    const link = str(r.productLink || r.product || r.productName || r.product_name);
    return names.some((n) => link === n);
  };
  return {
    cpp: cppRows.filter(matchProduct),
    cqa: cqaRows.filter(matchProduct),
  };
}
