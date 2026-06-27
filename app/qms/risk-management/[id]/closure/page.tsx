import { RiskClosurePage } from '@/components/risk-management/closure/risk-closure-page';

export default function Page({ params }: { params: { id: string } }) {
  return <RiskClosurePage riskAssessmentId={params.id} />;
}
