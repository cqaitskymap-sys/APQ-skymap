import { EnvironmentalAccessGuard } from '@/components/cpv/environmental-monitoring/environmental-access-guard';
import { EnvironmentalDetailView } from '@/components/cpv/environmental-monitoring/environmental-detail-view';

export default async function EnvironmentalDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <EnvironmentalAccessGuard>
      <EnvironmentalDetailView id={params.id} />
    </EnvironmentalAccessGuard>
  );
}
