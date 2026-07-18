import { CpvBatchAccessGuard } from '@/components/cpv/batch-registration/cpv-batch-access-guard';
import { CpvBatchDetailView } from '@/components/cpv/batch-registration/cpv-batch-detail-view';

export default async function CpvBatchDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <CpvBatchAccessGuard>
      <CpvBatchDetailView id={params.id} />
    </CpvBatchAccessGuard>
  );
}
