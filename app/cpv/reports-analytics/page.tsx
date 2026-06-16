import { ReportsAnalyticsAccessGuard } from '@/components/cpv/reports-analytics/reports-analytics-access-guard';
import { ReportsAnalyticsPage } from '@/components/cpv/reports-analytics/reports-analytics-page';

export const dynamic = 'force-dynamic';

export default function ReportsAnalyticsRoutePage() {
  return (
    <ReportsAnalyticsAccessGuard>
      <ReportsAnalyticsPage />
    </ReportsAnalyticsAccessGuard>
  );
}
