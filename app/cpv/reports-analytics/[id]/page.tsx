import { ReportsAnalyticsAccessGuard } from '@/components/cpv/reports-analytics/reports-analytics-access-guard';
import { ReportsAnalyticsDetailView } from '@/components/cpv/reports-analytics/reports-analytics-detail-view';

export const dynamic = 'force-dynamic';

export default function ReportsAnalyticsDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <ReportsAnalyticsAccessGuard>
      <ReportsAnalyticsDetailView id={params.id} />
    </ReportsAnalyticsAccessGuard>
  );
}
