import { DeviationAuditTrailView } from '@/components/deviations/audit-trail/deviation-audit-trail-view';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <DeviationAuditTrailView deviationId={params.id} />;
}
