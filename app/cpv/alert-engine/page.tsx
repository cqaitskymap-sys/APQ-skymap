import { AlertEngineAccessGuard } from '@/components/cpv/alert-engine/alert-engine-access-guard';
import { AlertEnginePage } from '@/components/cpv/alert-engine/alert-engine-page';

export const dynamic = 'force-dynamic';

export default function AlertEngineRoutePage() {
  return (
    <AlertEngineAccessGuard>
      <AlertEnginePage />
    </AlertEngineAccessGuard>
  );
}
