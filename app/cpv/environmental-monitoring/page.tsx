import { EnvironmentalAccessGuard } from '@/components/cpv/environmental-monitoring/environmental-access-guard';
import { EnvironmentalMonitoringPage } from '@/components/cpv/environmental-monitoring/environmental-monitoring-page';

export const dynamic = 'force-dynamic';

export default function EnvironmentalMonitoringRoutePage() {
  return (
    <EnvironmentalAccessGuard>
      <EnvironmentalMonitoringPage />
    </EnvironmentalAccessGuard>
  );
}
