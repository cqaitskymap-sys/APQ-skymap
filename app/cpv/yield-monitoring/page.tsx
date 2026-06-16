import { YieldAccessGuard } from '@/components/cpv/yield-monitoring/yield-access-guard';
import { YieldMonitoringPage } from '@/components/cpv/yield-monitoring/yield-monitoring-page';

export const dynamic = 'force-dynamic';

export default function YieldMonitoringRoutePage() {
  return (
    <YieldAccessGuard>
      <YieldMonitoringPage />
    </YieldAccessGuard>
  );
}
