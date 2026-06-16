import { DeviationAuditTrailView } from '@/components/deviations/audit-trail/deviation-audit-trail-view';

export default function Page({ params }: { params: { id: string } }) {
  return <DeviationAuditTrailView deviationId={params.id} />;
}
