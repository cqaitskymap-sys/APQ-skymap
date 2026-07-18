import { RawMaterialAccessGuard } from '@/components/cpv/raw-material-monitoring/raw-material-access-guard';
import { RawMaterialDetailView } from '@/components/cpv/raw-material-monitoring/raw-material-detail-view';

export default async function RawMaterialDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <RawMaterialAccessGuard>
      <RawMaterialDetailView id={params.id} />
    </RawMaterialAccessGuard>
  );
}
