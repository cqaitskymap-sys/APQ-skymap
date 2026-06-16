import { HoldTimeAccessGuard } from '@/components/cpv/hold-time-monitoring/hold-time-access-guard';
import { HoldTimeMonitoringPage } from '@/components/cpv/hold-time-monitoring/hold-time-monitoring-page';

export const dynamic = 'force-dynamic';

export default function HoldTimeMonitoringRoutePage() {
  return (
    <HoldTimeAccessGuard>
      <HoldTimeMonitoringPage />
    </HoldTimeAccessGuard>
  );
}
