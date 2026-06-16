import { TrendAnalysisAccessGuard } from '@/components/cpv/trend-analysis/trend-analysis-access-guard';
import { TrendAnalysisPage } from '@/components/cpv/trend-analysis/trend-analysis-page';

export const dynamic = 'force-dynamic';

export default function TrendAnalysisRoutePage() {
  return (
    <TrendAnalysisAccessGuard>
      <TrendAnalysisPage />
    </TrendAnalysisAccessGuard>
  );
}
