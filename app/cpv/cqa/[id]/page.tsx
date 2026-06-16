import { CqaAccessGuard } from '@/components/cpv/cqa-monitoring/cqa-access-guard';
import { CqaResultDetailView } from '@/components/cpv/cqa-monitoring/cqa-result-detail-view';

export default function CqaResultDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <CqaAccessGuard>
      <CqaResultDetailView id={params.id} />
    </CqaAccessGuard>
  );
}
