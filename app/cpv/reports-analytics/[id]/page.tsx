import { ReportsAnalyticsAccessGuard } from '@/components/cpv/reports-analytics/reports-analytics-access-guard';
import { ReportsAnalyticsDetailView } from '@/components/cpv/reports-analytics/reports-analytics-detail-view';

export const dynamic = 'force-dynamic';

export default async function ReportsAnalyticsDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <ReportsAnalyticsAccessGuard>
      <ReportsAnalyticsDetailView id={params.id} />
    </ReportsAnalyticsAccessGuard>
  );
}
