import { RiskAssessmentAccessGuard } from '@/components/cpv/risk-assessment/risk-assessment-access-guard';
import { RiskAssessmentPage } from '@/components/cpv/risk-assessment/risk-assessment-page';

export const dynamic = 'force-dynamic';

export default function RiskAssessmentRoutePage() {
  return (
    <RiskAssessmentAccessGuard>
      <RiskAssessmentPage />
    </RiskAssessmentAccessGuard>
  );
}
