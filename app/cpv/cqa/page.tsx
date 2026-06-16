import { CqaAccessGuard } from '@/components/cpv/cqa-monitoring/cqa-access-guard';
import { CqaMonitoringPage } from '@/components/cpv/cqa-monitoring/cqa-monitoring-page';

export const dynamic = 'force-dynamic';

export default function CpvCqaRoutePage() {
  return (
    <CqaAccessGuard>
      <CqaMonitoringPage />
    </CqaAccessGuard>
  );
}
