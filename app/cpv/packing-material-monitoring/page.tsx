import { PackingAccessGuard } from '@/components/cpv/packing-material-monitoring/packing-access-guard';
import { PackingMonitoringPage } from '@/components/cpv/packing-material-monitoring/packing-monitoring-page';

export const dynamic = 'force-dynamic';

export default function PackingMaterialMonitoringRoutePage() {
  return (
    <PackingAccessGuard>
      <PackingMonitoringPage />
    </PackingAccessGuard>
  );
}
