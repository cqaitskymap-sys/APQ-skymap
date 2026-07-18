import { RiskReviewPage } from '@/components/risk-management/review-monitoring/risk-review-page';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <RiskReviewPage riskAssessmentId={params.id} />;
}
