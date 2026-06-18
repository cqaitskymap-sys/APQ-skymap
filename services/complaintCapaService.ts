export {
  createCapaFromComplaintLegacy as createCapaFromComplaint,
  createComplaintCapaLink,
  fetchComplaintCapaPageData,
  getActiveComplaintCapaLink,
  getAuditLogsForComplaint,
  getComplaintCapaLinkHistory,
  linkExistingCapaToComplaint,
  listComplaintCapaLinks,
  mapComplaintCapaLinkFormDefaults,
  refreshComplaintCapaLinkStatus,
  saveComplaintCapaImplementation,
  saveComplaintCapaRequirement,
  unlinkCapaFromComplaint,
  updateLinkedComplaintCapaStatus,
  canCloseComplaintWithCapa,
  computeComplaintCapaMandatory,
  isComplaintCapaLinkOverdue,
} from '@/lib/complaint-capa-service';

export type { ComplaintCapaLinkActor, ComplaintCapaLinkFormInput } from '@/lib/complaint-capa-service';
