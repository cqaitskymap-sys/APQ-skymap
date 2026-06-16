import { UtilityAccessGuard } from '@/components/cpv/utility-monitoring/utility-access-guard';
import { UtilityMonitoringPage } from '@/components/cpv/utility-monitoring/utility-monitoring-page';

export const dynamic = 'force-dynamic';

export default function UtilityMonitoringRoutePage() {
  return (
    <UtilityAccessGuard>
      <UtilityMonitoringPage />
    </UtilityAccessGuard>
  );
}
