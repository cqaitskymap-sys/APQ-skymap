import { RawMaterialAccessGuard } from '@/components/cpv/raw-material-monitoring/raw-material-access-guard';
import { RawMaterialMonitoringPage } from '@/components/cpv/raw-material-monitoring/raw-material-monitoring-page';

export const dynamic = 'force-dynamic';

export default function RawMaterialMonitoringRoutePage() {
  return (
    <RawMaterialAccessGuard>
      <RawMaterialMonitoringPage />
    </RawMaterialAccessGuard>
  );
}
