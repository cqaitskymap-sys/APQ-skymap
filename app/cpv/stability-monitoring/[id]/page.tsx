import { StabilityAccessGuard } from '@/components/cpv/stability-monitoring/stability-access-guard';
import { StabilityDetailView } from '@/components/cpv/stability-monitoring/stability-detail-view';

export const dynamic = 'force-dynamic';

export default function StabilityDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <StabilityAccessGuard>
      <StabilityDetailView id={params.id} />
    </StabilityAccessGuard>
  );
}
