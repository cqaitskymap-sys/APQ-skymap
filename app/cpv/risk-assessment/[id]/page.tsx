import { RiskAssessmentAccessGuard } from '@/components/cpv/risk-assessment/risk-assessment-access-guard';
import { RiskAssessmentDetailView } from '@/components/cpv/risk-assessment/risk-assessment-detail-view';

export const dynamic = 'force-dynamic';

export default function RiskAssessmentDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <RiskAssessmentAccessGuard>
      <RiskAssessmentDetailView id={params.id} />
    </RiskAssessmentAccessGuard>
  );
}
