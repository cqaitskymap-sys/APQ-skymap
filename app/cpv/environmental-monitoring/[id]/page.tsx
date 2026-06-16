import { EnvironmentalAccessGuard } from '@/components/cpv/environmental-monitoring/environmental-access-guard';
import { EnvironmentalDetailView } from '@/components/cpv/environmental-monitoring/environmental-detail-view';

export default function EnvironmentalDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <EnvironmentalAccessGuard>
      <EnvironmentalDetailView id={params.id} />
    </EnvironmentalAccessGuard>
  );
}
