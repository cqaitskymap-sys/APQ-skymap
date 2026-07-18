import { RiskAuditTrailView } from '@/components/risk-management/audit-trail/risk-audit-trail-view';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <RiskAuditTrailView riskId={params.id} />;
}
