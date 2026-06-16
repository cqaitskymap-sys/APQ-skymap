import { getAdminRecords } from './admin-service';
import { ADMIN_COLLECTIONS } from './constants';
import {
  getDefaultCompanySite,
  formatDocumentHeader,
  isSiteActiveForRecords,
} from './company-site-service';
import type { CompanySite } from './schemas';

export { getDefaultCompanySite, isSiteActiveForRecords };

export function formatReportHeader(site: CompanySite): string {
  return formatDocumentHeader(site).replace(/\n/g, ' | ');
}

export async function getSystemSettings() {
  const settings = await getAdminRecords(ADMIN_COLLECTIONS.systemSettings);
  return settings[0] || null;
}

export async function getEsignSettings() {
  const { getEsignSettings: getGlobalEsign } = await import('./esign-service');
  return getGlobalEsign();
}
