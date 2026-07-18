import { RecallAuditTrailView } from '@/components/recall/audit-trail/recall-audit-trail-view';

export default async function RecallAuditTrailDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <RecallAuditTrailView recallId={params.id} />;
}
