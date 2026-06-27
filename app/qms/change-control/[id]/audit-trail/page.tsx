import { CcAuditTrailView } from '@/components/change-control/audit-trail/cc-audit-trail-view';

export default function Page({ params }: { params: { id: string } }) {
  return <CcAuditTrailView changeId={params.id} />;
}
