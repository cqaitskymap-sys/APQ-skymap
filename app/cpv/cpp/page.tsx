import { CppAccessGuard } from '@/components/cpv/cpp-monitoring/cpp-access-guard';
import { CppMonitoringPage } from '@/components/cpv/cpp-monitoring/cpp-monitoring-page';

export const dynamic = 'force-dynamic';

export default function CpvCppRoutePage() {
  return (
    <CppAccessGuard>
      <CppMonitoringPage />
    </CppAccessGuard>
  );
}
