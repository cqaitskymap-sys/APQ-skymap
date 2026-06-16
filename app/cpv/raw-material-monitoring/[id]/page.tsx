import { RawMaterialAccessGuard } from '@/components/cpv/raw-material-monitoring/raw-material-access-guard';
import { RawMaterialDetailView } from '@/components/cpv/raw-material-monitoring/raw-material-detail-view';

export default function RawMaterialDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <RawMaterialAccessGuard>
      <RawMaterialDetailView id={params.id} />
    </RawMaterialAccessGuard>
  );
}
