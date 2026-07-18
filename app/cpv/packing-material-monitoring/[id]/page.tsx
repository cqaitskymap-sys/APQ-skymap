import { PackingAccessGuard } from '@/components/cpv/packing-material-monitoring/packing-access-guard';
import { PackingDetailView } from '@/components/cpv/packing-material-monitoring/packing-detail-view';

export default async function PackingMaterialDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <PackingAccessGuard>
      <PackingDetailView id={params.id} />
    </PackingAccessGuard>
  );
}
