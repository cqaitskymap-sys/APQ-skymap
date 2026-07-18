import { StabilityAccessGuard } from '@/components/cpv/stability-monitoring/stability-access-guard';
import { StabilityDetailView } from '@/components/cpv/stability-monitoring/stability-detail-view';

export const dynamic = 'force-dynamic';

export default async function StabilityDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <StabilityAccessGuard>
      <StabilityDetailView id={params.id} />
    </StabilityAccessGuard>
  );
}
