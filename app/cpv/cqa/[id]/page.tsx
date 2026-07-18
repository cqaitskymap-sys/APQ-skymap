import { CqaAccessGuard } from '@/components/cpv/cqa-monitoring/cqa-access-guard';
import { CqaResultDetailView } from '@/components/cpv/cqa-monitoring/cqa-result-detail-view';

export default async function CqaResultDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <CqaAccessGuard>
      <CqaResultDetailView id={params.id} />
    </CqaAccessGuard>
  );
}
