import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage, isFirebaseConfigured } from '@/lib/firebase';
import { writeAuditTrail } from '@/lib/audit-trail';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS, PRODUCT_ATTACHMENT_MAX_BYTES } from './constants';
import type {
  AdminProduct, ProductFormData, ProductCompositionRow,
  ProductPackingRow, ProductAttachment,
} from './schemas';

export interface ProductAuditMeta {
  userId: string;
  userName: string;
}

async function logProductAudit(
  action: string,
  recordId: string,
  meta: ProductAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Product Master',
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
    collectionName: ADMIN_COLLECTIONS.products,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Product Master',
  });
}

export function buildProductId(code: string): string {
  return `PROD-${code.toUpperCase().replace(/\s+/g, '-')}`;
}

export function normalizeProduct(p: AdminProduct): AdminProduct {
  return {
    ...p,
    manufacturingLicenseNo: p.manufacturingLicenseNumber || p.manufacturingLicenseNo || '',
    manufacturingLicenseNumber: p.manufacturingLicenseNumber || p.manufacturingLicenseNo || '',
    standardBatchSize: p.standardBatchSize || p.batchSize || '',
    batchSize: p.standardBatchSize || p.batchSize || '',
    status: p.productStatus === 'Active' ? 'Active' : 'Inactive',
  };
}

export async function fetchProducts(): Promise<AdminProduct[]> {
  try {
    const records = await getAdminRecords<AdminProduct>(ADMIN_COLLECTIONS.products);
    return records.filter((p) => !p.isDeleted).map(normalizeProduct);
  } catch {
    return [];
  }
}

export async function fetchProductById(id: string): Promise<AdminProduct | null> {
  const products = await fetchProducts();
  return products.find((p) => p.id === id) ?? null;
}

export async function fetchProductCompositions(productId: string): Promise<ProductCompositionRow[]> {
  try {
    const all = await getAdminRecords<ProductCompositionRow & { productId: string }>(
      ADMIN_COLLECTIONS.productCompositions,
    );
    return all.filter((c) => c.productId === productId && !(c as { isDeleted?: boolean }).isDeleted);
  } catch {
    return [];
  }
}

export async function fetchProductPacking(productId: string): Promise<ProductPackingRow[]> {
  try {
    const all = await getAdminRecords<ProductPackingRow & { productId: string }>(
      ADMIN_COLLECTIONS.productPackingDetails,
    );
    return all.filter((p) => p.productId === productId && !(p as { isDeleted?: boolean }).isDeleted);
  } catch {
    return [];
  }
}

export async function fetchProductAttachments(productId: string): Promise<ProductAttachment[]> {
  try {
    const all = await getAdminRecords<ProductAttachment>(ADMIN_COLLECTIONS.productAttachments);
    return all.filter((a) => a.productId === productId && !(a as { isDeleted?: boolean }).isDeleted);
  } catch {
    return [];
  }
}

export async function isProductActiveForUse(productCodeOrId: string): Promise<boolean> {
  const products = await fetchProducts();
  const p = products.find(
    (x) => x.id === productCodeOrId || x.productCode === productCodeOrId || x.productId === productCodeOrId,
  );
  if (!p) return true;
  return p.productStatus === 'Active';
}

function productPayload(data: ProductFormData, meta: ProductAuditMeta) {
  const productId = buildProductId(data.productCode);
  return {
    productId,
    productCode: data.productCode,
    productName: data.productName,
    genericName: data.genericName,
    brandName: data.brandName,
    strength: data.strength,
    dosageForm: data.dosageForm,
    routeOfAdministration: data.routeOfAdministration,
    packSize: data.packSize,
    market: data.market,
    therapeuticCategory: data.therapeuticCategory,
    shelfLife: data.shelfLife,
    storageCondition: data.storageCondition,
    standardBatchSize: data.standardBatchSize,
    batchSize: data.standardBatchSize,
    manufacturingLicenseNumber: data.manufacturingLicenseNumber,
    manufacturingLicenseNo: data.manufacturingLicenseNumber,
    mfrNumber: data.mfrNumber,
    bmrNumber: data.bmrNumber,
    bprNumber: data.bprNumber,
    specificationNumber: data.specificationNumber,
    stpNumber: data.stpNumber,
    productStatus: data.productStatus,
    status: data.productStatus === 'Active' ? 'Active' : 'Inactive',
    remarks: data.remarks,
    composition: data.compositions.map((c) => c.ingredientName).join(', '),
    packingStyle: data.packingDetails.map((p) => p.packingMaterial).join(', '),
    createdBy: meta.userId,
    updatedBy: meta.userId,
  };
}

async function syncCompositions(
  productId: string,
  rows: ProductCompositionRow[],
  meta: ProductAuditMeta,
  existing: ProductCompositionRow[],
) {
  const existingIds = new Set(existing.map((e) => e.id).filter(Boolean));
  const newIds = new Set(rows.map((r) => r.id).filter(Boolean));

  for (const row of rows) {
    const payload = { ...row, productId };
    if (row.id && existingIds.has(row.id)) {
      await updateAdminRecord(ADMIN_COLLECTIONS.productCompositions, row.id, payload, {
        userId: meta.userId, userName: meta.userName, module: 'Product Master',
        oldValue: JSON.stringify(existing.find((e) => e.id === row.id)),
      });
      await logProductAudit('COMPOSITION_EDIT', productId, meta, null, row);
    } else {
      const created = await createAdminRecord(ADMIN_COLLECTIONS.productCompositions, payload as Record<string, unknown>, {
        userId: meta.userId, userName: meta.userName, module: 'Product Master', action: 'COMPOSITION_ADD',
      });
      await logProductAudit('COMPOSITION_ADD', productId, meta, null, created);
    }
  }

  for (const old of existing) {
    if (old.id && !newIds.has(old.id)) {
      await updateAdminRecord(ADMIN_COLLECTIONS.productCompositions, old.id, { isDeleted: true }, {
        userId: meta.userId, userName: meta.userName, module: 'Product Master',
        oldValue: JSON.stringify(old),
      });
      await logProductAudit('COMPOSITION_DELETE', productId, meta, old, null);
    }
  }
}

async function syncPacking(
  productId: string,
  rows: ProductPackingRow[],
  meta: ProductAuditMeta,
  existing: ProductPackingRow[],
) {
  const existingIds = new Set(existing.map((e) => e.id).filter(Boolean));
  const newIds = new Set(rows.map((r) => r.id).filter(Boolean));

  for (const row of rows) {
    const payload = { ...row, productId };
    if (row.id && existingIds.has(row.id)) {
      await updateAdminRecord(ADMIN_COLLECTIONS.productPackingDetails, row.id, payload, {
        userId: meta.userId, userName: meta.userName, module: 'Product Master',
        oldValue: JSON.stringify(existing.find((e) => e.id === row.id)),
      });
      await logProductAudit('PACKING_EDIT', productId, meta, null, row);
    } else {
      const created = await createAdminRecord(ADMIN_COLLECTIONS.productPackingDetails, payload as Record<string, unknown>, {
        userId: meta.userId, userName: meta.userName, module: 'Product Master', action: 'PACKING_ADD',
      });
      await logProductAudit('PACKING_ADD', productId, meta, null, created);
    }
  }

  for (const old of existing) {
    if (old.id && !newIds.has(old.id)) {
      await updateAdminRecord(ADMIN_COLLECTIONS.productPackingDetails, old.id, { isDeleted: true }, {
        userId: meta.userId, userName: meta.userName, module: 'Product Master',
        oldValue: JSON.stringify(old),
      });
      await logProductAudit('PACKING_DELETE', productId, meta, old, null);
    }
  }
}

export async function createProduct(
  data: ProductFormData,
  meta: ProductAuditMeta,
): Promise<{ product: AdminProduct | null; error: string | null }> {
  try {
    const unique = await checkUniqueField(ADMIN_COLLECTIONS.products, 'productCode', data.productCode);
    if (!unique) return { product: null, error: 'Product code already exists' };

    const payload = productPayload(data, meta);
    const created = await createAdminRecord(ADMIN_COLLECTIONS.products, payload as Omit<AdminProduct, 'id'>, {
      userId: meta.userId, userName: meta.userName, module: 'Product Master', action: 'CREATE_PRODUCT',
    });

    const productId = created.id!;
    await syncCompositions(productId, data.compositions, meta, []);
    await syncPacking(productId, data.packingDetails, meta, []);

    await logProductAudit('CREATE_PRODUCT', productId, meta, null, payload);
    return { product: normalizeProduct(created as AdminProduct), error: null };
  } catch (e) {
    return { product: null, error: (e as Error).message };
  }
}

export async function updateProduct(
  id: string,
  data: ProductFormData,
  existing: AdminProduct,
  meta: ProductAuditMeta,
): Promise<{ product: AdminProduct | null; error: string | null }> {
  try {
    if (data.productCode !== existing.productCode) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.products, 'productCode', data.productCode, id);
      if (!unique) return { product: null, error: 'Product code already exists' };
    }

    const updates = productPayload(data, meta);
    delete (updates as { createdBy?: string }).createdBy;

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.products, id, updates, {
      userId: meta.userId, userName: meta.userName, module: 'Product Master',
      oldValue: JSON.stringify(existing),
    });

    const [oldComp, oldPack] = await Promise.all([
      fetchProductCompositions(id),
      fetchProductPacking(id),
    ]);
    await syncCompositions(id, data.compositions, meta, oldComp);
    await syncPacking(id, data.packingDetails, meta, oldPack);

    await logProductAudit('EDIT_PRODUCT', id, meta, existing, updates);
    return { product: normalizeProduct(updated as AdminProduct), error: null };
  } catch (e) {
    return { product: null, error: (e as Error).message };
  }
}

export async function setProductStatus(
  id: string,
  product: AdminProduct,
  productStatus: AdminProduct['productStatus'],
  meta: ProductAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  try {
    const status = productStatus === 'Active' ? 'Active' : 'Inactive';
    await updateAdminRecord(ADMIN_COLLECTIONS.products, id, { productStatus, status }, {
      userId: meta.userId, userName: meta.userName, module: 'Product Master',
      oldValue: JSON.stringify(product),
    });
    const action = productStatus === 'Active' ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED';
    await logProductAudit(action, id, meta, product.productStatus, productStatus);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function uploadProductAttachment(
  productId: string,
  file: File,
  attachmentType: ProductAttachment['attachmentType'],
  meta: ProductAuditMeta,
): Promise<{ attachment: ProductAttachment | null; error?: string }> {
  if (file.size > PRODUCT_ATTACHMENT_MAX_BYTES) {
    return { attachment: null, error: 'File must be 10 MB or smaller' };
  }
  if (!isFirebaseConfigured()) {
    return { attachment: null, error: 'Firebase Storage is not configured' };
  }

  try {
    const path = `products/${productId}/attachments/${Date.now()}_${file.name}`;
    const storageRef = ref(getFirebaseStorage(), path);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    const payload: Omit<ProductAttachment, 'id'> = {
      productId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      attachmentType,
      storagePath: path,
      downloadUrl,
      uploadedBy: meta.userId,
    };

    const created = await createAdminRecord(ADMIN_COLLECTIONS.productAttachments, payload as Record<string, unknown>, {
      userId: meta.userId, userName: meta.userName, module: 'Product Master', action: 'ATTACHMENT_UPLOAD',
    });

    await logProductAudit('ATTACHMENT_UPLOAD', productId, meta, null, { fileName: file.name, attachmentType });
    return { attachment: created as ProductAttachment };
  } catch (e) {
    return { attachment: null, error: (e as Error).message };
  }
}

export async function deleteProductAttachment(
  attachment: ProductAttachment,
  meta: ProductAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (attachment.storagePath && isFirebaseConfigured()) {
      try {
        await deleteObject(ref(getFirebaseStorage(), attachment.storagePath));
      } catch {
        /* storage file may already be removed */
      }
    }
    if (attachment.id) {
      await updateAdminRecord(ADMIN_COLLECTIONS.productAttachments, attachment.id, { isDeleted: true }, {
        userId: meta.userId, userName: meta.userName, module: 'Product Master',
        oldValue: JSON.stringify(attachment),
      });
    }
    await logProductAudit('ATTACHMENT_DELETE', attachment.productId, meta, attachment, null);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function fetchProductAuditTrail(recordId: string) {
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

export function exportProductsCsv(products: AdminProduct[]): string {
  const headers = [
    'Product ID', 'Code', 'Name', 'Generic Name', 'Strength', 'Dosage Form',
    'Market', 'Shelf Life', 'Status',
  ];
  const rows = products.map((p) => [
    p.productId, p.productCode, p.productName, p.genericName, p.strength,
    p.dosageForm, p.market, p.shelfLife, p.productStatus,
  ]);
  return [headers.join(','), ...rows.map((row) =>
    row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','),
  )].join('\n');
}

export async function logProductExport(meta: ProductAuditMeta, count: number) {
  await logProductAudit('EXPORT_PRODUCT_LIST', 'export', meta, null, { count });
}

export function parseProductImportRows(text: string): Partial<ProductFormData>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const idx = (name: string) => headers.findIndex((h) => h.includes(name));

  const codeI = idx('product code') >= 0 ? idx('product code') : idx('code');
  const nameI = idx('product name') >= 0 ? idx('product name') : idx('name');
  const genericI = idx('generic');
  const strengthI = idx('strength');
  const formI = idx('dosage');
  const marketI = idx('market');
  const shelfI = idx('shelf');

  return lines.slice(1).map((line) => {
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];
    return {
      productCode: cols[codeI] || '',
      productName: cols[nameI] || '',
      genericName: cols[genericI] || cols[nameI] || '',
      strength: cols[strengthI] || '',
      dosageForm: (cols[formI] || 'Other') as ProductFormData['dosageForm'],
      market: (cols[marketI] || 'Domestic') as ProductFormData['market'],
      shelfLife: cols[shelfI] || '24',
      productStatus: 'Active' as const,
      compositions: [{
        ingredientName: 'API',
        ingredientType: 'API' as const,
        grade: '',
        quantity: 1,
        unit: 'mg',
        functionPurpose: '',
        specificationNo: '',
        stpNo: '',
      }],
      packingDetails: [],
    };
  }).filter((r) => r.productCode && r.productName);
}

export async function importProductsFromFile(
  file: File,
  meta: ProductAuditMeta,
): Promise<{ imported: number; errors: string[] }> {
  const text = await file.text();
  const rows = parseProductImportRows(text);
  let imported = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const data: ProductFormData = {
      productCode: row.productCode!,
      productName: row.productName!,
      genericName: row.genericName || row.productName!,
      brandName: '',
      strength: row.strength || 'N/A',
      dosageForm: row.dosageForm || 'Other',
      routeOfAdministration: '',
      packSize: '',
      market: row.market || 'Domestic',
      therapeuticCategory: '',
      shelfLife: row.shelfLife || '24',
      storageCondition: '',
      standardBatchSize: '',
      manufacturingLicenseNumber: '',
      mfrNumber: '',
      bmrNumber: '',
      bprNumber: '',
      specificationNumber: '',
      stpNumber: '',
      productStatus: 'Active',
      remarks: 'Imported',
      compositions: row.compositions || [{
        ingredientName: 'API', ingredientType: 'API', grade: '', quantity: 1, unit: 'mg',
        functionPurpose: '', specificationNo: '', stpNo: '',
      }],
      packingDetails: [],
    };

    const result = await createProduct(data, meta);
    if (result.error) errors.push(`${data.productCode}: ${result.error}`);
    else imported += 1;
  }

  if (imported) await logProductAudit('IMPORT_PRODUCT', 'import', meta, null, { imported, errors: errors.length });
  return { imported, errors };
}
