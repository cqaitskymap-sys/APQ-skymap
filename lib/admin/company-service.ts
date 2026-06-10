import { getRecords } from '@/lib/firestore-service';
import { ADMIN_COLLECTIONS } from './constants';
import type { CompanySite } from './schemas';

export async function getDefaultCompanySite(): Promise<CompanySite | null> {
  const sites = await getRecords<CompanySite>(ADMIN_COLLECTIONS.companySites);
  return sites.find((s) => s.isDefault) || sites[0] || null;
}

export function formatReportHeader(site: CompanySite): string {
  if (site.documentHeaderFormat) return site.documentHeaderFormat;
  return [
    site.companyName,
    site.siteName,
    site.plantAddress,
    [site.city, site.state, site.country].filter(Boolean).join(', '),
    site.licenseNo ? `License: ${site.licenseNo}` : '',
  ].filter(Boolean).join(' | ');
}

export async function getSystemSettings() {
  const settings = await getRecords(ADMIN_COLLECTIONS.systemSettings);
  return settings[0] || null;
}

export async function getEsignSettings() {
  const settings = await getRecords(ADMIN_COLLECTIONS.esignSettings);
  return settings[0] || null;
}
