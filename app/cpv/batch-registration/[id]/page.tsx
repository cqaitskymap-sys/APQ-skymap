import { CpvBatchAccessGuard } from '@/components/cpv/batch-registration/cpv-batch-access-guard';
import { CpvBatchDetailView } from '@/components/cpv/batch-registration/cpv-batch-detail-view';

export default function CpvBatchDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <CpvBatchAccessGuard>
      <CpvBatchDetailView id={params.id} />
    </CpvBatchAccessGuard>
  );
}
