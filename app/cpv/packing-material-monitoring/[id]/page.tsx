import { PackingAccessGuard } from '@/components/cpv/packing-material-monitoring/packing-access-guard';
import { PackingDetailView } from '@/components/cpv/packing-material-monitoring/packing-detail-view';

export default function PackingMaterialDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <PackingAccessGuard>
      <PackingDetailView id={params.id} />
    </PackingAccessGuard>
  );
}
