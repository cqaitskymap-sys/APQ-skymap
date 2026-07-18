import { RiskAssessmentAccessGuard } from '@/components/cpv/risk-assessment/risk-assessment-access-guard';
import { RiskAssessmentDetailView } from '@/components/cpv/risk-assessment/risk-assessment-detail-view';

export const dynamic = 'force-dynamic';

export default async function RiskAssessmentDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <RiskAssessmentAccessGuard>
      <RiskAssessmentDetailView id={params.id} />
    </RiskAssessmentAccessGuard>
  );
}
