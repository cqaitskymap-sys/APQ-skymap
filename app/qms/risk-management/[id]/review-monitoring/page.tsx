import { RiskReviewPage } from '@/components/risk-management/review-monitoring/risk-review-page';

export default function Page({ params }: { params: { id: string } }) {
  return <RiskReviewPage riskAssessmentId={params.id} />;
}
