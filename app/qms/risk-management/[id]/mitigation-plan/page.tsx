import { RiskMitigationPage } from '@/components/risk-management/mitigation/risk-mitigation-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <RiskMitigationPage riskAssessmentId={params.id} />;
}
