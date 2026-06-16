import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage, isFirebaseConfigured } from '@/lib/firebase';
import { writeAuditTrail } from '@/lib/audit-trail';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import { ADMIN_COLLECTIONS, LOGO_ALLOWED_TYPES, LOGO_MAX_BYTES } from './constants';
import type { CompanySite, CompanySiteFormData } from './schemas';

export interface CompanySiteAuditMeta {
  userId: string;
  userName: string;
}

async function logCompanySiteAudit(
  action: string,
  recordId: string,
  meta: CompanySiteAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Company / Site Master',
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
    collectionName: ADMIN_COLLECTIONS.companySites,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Company / Site Master',
  });
}

export function buildCompanyId(code: string): string {
  return `COMP-${code.toUpperCase().replace(/\s+/g, '-')}`;
}

export function buildSiteRecordId(code: string): string {
  return `SITE-${code.toUpperCase().replace(/\s+/g, '-')}`;
}

export function normalizeSite(site: CompanySite): CompanySite {
  return {
    ...site,
    gstNo: site.gstNumber || site.gstNo || '',
    gstNumber: site.gstNumber || site.gstNo || '',
    contactNumber: site.contactPhone || site.contactNumber || '',
    contactPhone: site.contactPhone || site.contactNumber || '',
    defaultTimezone: site.timezone || site.defaultTimezone || 'Asia/Kolkata',
    timezone: site.timezone || site.defaultTimezone || 'Asia/Kolkata',
    licenseNo: site.manufacturingLicenseNumber || site.licenseNo || '',
  };
}

export function formatDocumentHeader(site: CompanySite): string {
  if (site.documentHeaderFormat) return site.documentHeaderFormat;
  const s = normalizeSite(site);
  return [
    s.companyName,
    s.siteName,
    s.plantName ? `Plant: ${s.plantName}` : '',
    s.plantAddress,
    [s.city, s.state, s.country, s.pinZipCode].filter(Boolean).join(', '),
    s.gstNumber ? `GST: ${s.gstNumber}` : '',
    s.manufacturingLicenseNumber ? `Mfg License: ${s.manufacturingLicenseNumber}` : '',
    s.drugLicenseNumber ? `Drug License: ${s.drugLicenseNumber}` : '',
  ].filter(Boolean).join('\n');
}

export function formatDocumentFooter(site: CompanySite): string {
  if (site.documentFooterText) return site.documentFooterText;
  const s = normalizeSite(site);
  const parts = [
    s.website ? s.website : '',
    s.contactEmail ? `Email: ${s.contactEmail}` : '',
    s.contactPhone ? `Phone: ${s.contactPhone}` : '',
    'This document is confidential and intended for authorized use only.',
  ].filter(Boolean);
  return parts.join(' | ');
}

export async function fetchCompanySites(): Promise<CompanySite[]> {
  try {
    const records = await getAdminRecords<CompanySite>(ADMIN_COLLECTIONS.companySites);
    return records.filter((s) => !s.isDeleted).map(normalizeSite);
  } catch {
    return [];
  }
}

export async function fetchCompanySiteById(id: string): Promise<CompanySite | null> {
  const sites = await fetchCompanySites();
  return sites.find((s) => s.id === id) ?? null;
}

export async function getDefaultCompanySite(): Promise<CompanySite | null> {
  const sites = await fetchCompanySites();
  const activeDefault = sites.find((s) => s.isDefault && s.status === 'Active');
  return activeDefault || sites.find((s) => s.status === 'Active') || sites[0] || null;
}

export async function isSiteActiveForRecords(siteIdOrCode: string): Promise<boolean> {
  const sites = await fetchCompanySites();
  const site = sites.find(
    (s) => s.id === siteIdOrCode || s.siteCode === siteIdOrCode || s.companyId === siteIdOrCode,
  );
  if (!site) return true;
  return site.status === 'Active';
}

export function validateLogoFile(file: File): { valid: boolean; error?: string } {
  if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Logo must be PNG, JPG, JPEG, or WEBP' };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { valid: false, error: 'Logo must be 2 MB or smaller' };
  }
  return { valid: true };
}

export async function uploadCompanyLogo(
  siteId: string,
  file: File,
  meta: CompanySiteAuditMeta,
  existingLogo?: string,
): Promise<{ url: string | null; error?: string }> {
  const check = validateLogoFile(file);
  if (!check.valid) return { url: null, error: check.error };

  if (!isFirebaseConfigured()) {
    return { url: null, error: 'Firebase Storage is not configured' };
  }

  try {
    const path = `company-sites/${siteId}/logo/${Date.now()}_${file.name}`;
    const storageRef = ref(getFirebaseStorage(), path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await logCompanySiteAudit(
      existingLogo ? 'LOGO_CHANGE' : 'LOGO_UPLOAD',
      siteId,
      meta,
      existingLogo || null,
      url,
    );
    return { url };
  } catch (e) {
    return { url: null, error: (e as Error).message };
  }
}

function formToPayload(data: CompanySiteFormData, meta: CompanySiteAuditMeta) {
  const companyId = buildCompanyId(data.companyCode);
  return {
    companyId,
    companyName: data.companyName,
    companyCode: data.companyCode,
    siteName: data.siteName,
    siteCode: data.siteCode,
    siteType: data.siteType,
    plantName: data.plantName,
    plantCode: data.plantCode,
    plantAddress: data.plantAddress,
    city: data.city,
    state: data.state,
    country: data.country,
    pinZipCode: data.pinZipCode,
    gstNumber: data.gstNumber,
    gstNo: data.gstNumber,
    manufacturingLicenseNumber: data.manufacturingLicenseNumber,
    drugLicenseNumber: data.drugLicenseNumber,
    licenseNo: data.manufacturingLicenseNumber,
    contactPerson: data.contactPerson,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    contactNumber: data.contactPhone,
    website: data.website,
    timezone: data.timezone,
    defaultTimezone: data.timezone,
    dateFormat: data.dateFormat,
    timeFormat: data.timeFormat,
    defaultCurrency: data.defaultCurrency,
    documentHeaderFormat: data.documentHeaderFormat,
    documentFooterText: data.documentFooterText,
    status: data.status,
    isDefault: data.isDefault,
    createdBy: meta.userId,
    updatedBy: meta.userId,
  };
}

export async function createCompanySite(
  data: CompanySiteFormData,
  meta: CompanySiteAuditMeta,
): Promise<{ site: CompanySite | null; error: string | null }> {
  try {
    const codeUnique = await checkUniqueField(ADMIN_COLLECTIONS.companySites, 'companyCode', data.companyCode);
    if (!codeUnique) return { site: null, error: 'Company code already exists' };

    const siteCodeUnique = await checkUniqueField(ADMIN_COLLECTIONS.companySites, 'siteCode', data.siteCode);
    if (!siteCodeUnique) return { site: null, error: 'Site code already exists' };

    const payload = formToPayload(data, meta);

    if (data.isDefault) {
      await clearDefaultSite(meta);
    }

    const created = await createAdminRecord(ADMIN_COLLECTIONS.companySites, payload as Omit<CompanySite, 'id'>, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Company / Site Master',
      action: 'CREATE_COMPANY_SITE',
    });

    await logCompanySiteAudit('CREATE_COMPANY_SITE', created.id || payload.companyId, meta, null, payload);
    return { site: normalizeSite(created as CompanySite), error: null };
  } catch (e) {
    return { site: null, error: (e as Error).message };
  }
}

export async function updateCompanySite(
  id: string,
  data: CompanySiteFormData,
  existing: CompanySite,
  meta: CompanySiteAuditMeta,
): Promise<{ site: CompanySite | null; error: string | null }> {
  try {
    if (data.companyCode !== existing.companyCode) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.companySites, 'companyCode', data.companyCode, id);
      if (!unique) return { site: null, error: 'Company code already exists' };
    }
    if (data.siteCode !== existing.siteCode) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.companySites, 'siteCode', data.siteCode, id);
      if (!unique) return { site: null, error: 'Site code already exists' };
    }

    const updates = formToPayload(data, meta);
    delete (updates as { createdBy?: string }).createdBy;

    if (data.isDefault && !existing.isDefault) {
      await clearDefaultSite(meta);
    }

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.companySites, id, updates, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Company / Site Master',
      oldValue: JSON.stringify(existing),
    });

    await logCompanySiteAudit('EDIT_COMPANY_SITE', id, meta, existing, updates);
    return { site: normalizeSite(updated as CompanySite), error: null };
  } catch (e) {
    return { site: null, error: (e as Error).message };
  }
}

async function clearDefaultSite(meta: CompanySiteAuditMeta) {
  const sites = await fetchCompanySites();
  for (const s of sites.filter((x) => x.isDefault && x.id)) {
    await updateAdminRecord(ADMIN_COLLECTIONS.companySites, s.id!, { isDefault: false }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Company / Site Master',
      oldValue: JSON.stringify({ isDefault: true }),
    });
  }
}

export async function setCompanySiteStatus(
  id: string,
  site: CompanySite,
  status: 'Active' | 'Inactive',
  meta: CompanySiteAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  if (site.isDefault && status === 'Inactive') {
    return { success: false, error: 'Cannot deactivate the default site. Set another site as default first.' };
  }

  try {
    await updateAdminRecord(ADMIN_COLLECTIONS.companySites, id, { status }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Company / Site Master',
      oldValue: JSON.stringify(site),
    });
    const action = status === 'Active' ? 'SITE_ACTIVATED' : 'SITE_DEACTIVATED';
    await logCompanySiteAudit(action, id, meta, site.status, status);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function setDefaultCompanySite(
  id: string,
  site: CompanySite,
  meta: CompanySiteAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  if (site.status !== 'Active') {
    return { success: false, error: 'Only active sites can be set as default' };
  }

  try {
    await clearDefaultSite(meta);
    await updateAdminRecord(ADMIN_COLLECTIONS.companySites, id, { isDefault: true }, {
      userId: meta.userId,
      userName: meta.userName,
      module: 'Company / Site Master',
      oldValue: JSON.stringify(site),
    });
    await logCompanySiteAudit('SET_DEFAULT_SITE', id, meta, site.isDefault, true);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function updateCompanyLogo(
  id: string,
  logoUrl: string,
  existing: CompanySite,
  meta: CompanySiteAuditMeta,
): Promise<void> {
  await updateAdminRecord(ADMIN_COLLECTIONS.companySites, id, { companyLogo: logoUrl }, {
    userId: meta.userId,
    userName: meta.userName,
    module: 'Company / Site Master',
    oldValue: JSON.stringify({ companyLogo: existing.companyLogo }),
  });
}

export async function fetchCompanySiteAuditTrail(recordId: string) {
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

export function exportCompanySitesCsv(sites: CompanySite[]): string {
  const headers = [
    'Company ID', 'Company Name', 'Company Code', 'Site Name', 'Site Code',
    'Site Type', 'City', 'State', 'Country', 'Status', 'Default',
  ];
  const rows = sites.map((s) => [
    s.companyId, s.companyName, s.companyCode, s.siteName, s.siteCode,
    s.siteType, s.city, s.state, s.country, s.status, s.isDefault,
  ]);
  return [headers.join(','), ...rows.map((row) =>
    row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','),
  )].join('\n');
}

export async function logCompanySiteExport(meta: CompanySiteAuditMeta, count: number) {
  await logCompanySiteAudit('EXPORT_COMPANY_SITE_LIST', 'export', meta, null, { count });
}
