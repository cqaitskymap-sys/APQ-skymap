import { RiskAuditTrailView } from '@/components/risk-management/audit-trail/risk-audit-trail-view';

export default function Page({ params }: { params: { id: string } }) {
  return <RiskAuditTrailView riskId={params.id} />;
}
