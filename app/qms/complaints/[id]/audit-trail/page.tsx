import { ComplaintAuditTrailView } from '@/components/complaints/audit-trail/complaint-audit-trail-view';

export default function Page({ params }: { params: { id: string } }) {
  return <ComplaintAuditTrailView complaintId={params.id} />;
}
