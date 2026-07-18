import { RiskClosurePage } from '@/components/risk-management/closure/risk-closure-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <RiskClosurePage riskAssessmentId={params.id} />;
}
