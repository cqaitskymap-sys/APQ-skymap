import { RecallAuditTrailView } from '@/components/recall/audit-trail/recall-audit-trail-view';

export default function RecallAuditTrailDetailPage({ params }: { params: { id: string } }) {
  return <RecallAuditTrailView recallId={params.id} />;
}
