import { TrendAnalysisAccessGuard } from '@/components/cpv/trend-analysis/trend-analysis-access-guard';
import { TrendAnalysisDetailView } from '@/components/cpv/trend-analysis/trend-analysis-detail-view';

export const dynamic = 'force-dynamic';

export default function TrendAnalysisDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <TrendAnalysisAccessGuard>
      <TrendAnalysisDetailView id={params.id} />
    </TrendAnalysisAccessGuard>
  );
}
