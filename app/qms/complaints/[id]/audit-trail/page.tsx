import { ComplaintAuditTrailView } from '@/components/complaints/audit-trail/complaint-audit-trail-view';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <ComplaintAuditTrailView complaintId={params.id} />;
}
