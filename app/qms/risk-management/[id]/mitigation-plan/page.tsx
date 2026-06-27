import { RiskMitigationPage } from '@/components/risk-management/mitigation/risk-mitigation-page';

export default function Page({ params }: { params: { id: string } }) {
  return <RiskMitigationPage riskAssessmentId={params.id} />;
}
