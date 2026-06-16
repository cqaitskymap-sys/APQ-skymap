import { CpvBatchAccessGuard } from '@/components/cpv/batch-registration/cpv-batch-access-guard';
import { CpvBatchListPage } from '@/components/cpv/batch-registration/cpv-batch-list-page';

export default function CpvBatchRegistrationRoutePage() {
  return (
    <CpvBatchAccessGuard>
      <CpvBatchListPage />
    </CpvBatchAccessGuard>
  );
}
