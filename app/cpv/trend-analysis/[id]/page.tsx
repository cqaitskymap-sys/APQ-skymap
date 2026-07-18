import { TrendAnalysisAccessGuard } from '@/components/cpv/trend-analysis/trend-analysis-access-guard';
import { TrendAnalysisDetailView } from '@/components/cpv/trend-analysis/trend-analysis-detail-view';

export const dynamic = 'force-dynamic';

export default async function TrendAnalysisDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <TrendAnalysisAccessGuard>
      <TrendAnalysisDetailView id={params.id} />
    </TrendAnalysisAccessGuard>
  );
}
