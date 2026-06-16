import { StabilityAccessGuard } from '@/components/cpv/stability-monitoring/stability-access-guard';
import { StabilityMonitoringPage } from '@/components/cpv/stability-monitoring/stability-monitoring-page';

export const dynamic = 'force-dynamic';

export default function StabilityMonitoringRoutePage() {
  return (
    <StabilityAccessGuard>
      <StabilityMonitoringPage />
    </StabilityAccessGuard>
  );
}
