import { SpcAccessGuard } from '@/components/cpv/statistical-process-control/spc-access-guard';
import { SpcPage } from '@/components/cpv/statistical-process-control/spc-page';

export const dynamic = 'force-dynamic';

export default function StatisticalProcessControlRoutePage() {
  return (
    <SpcAccessGuard>
      <SpcPage />
    </SpcAccessGuard>
  );
}
