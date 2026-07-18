import { HoldTimeAccessGuard } from '@/components/cpv/hold-time-monitoring/hold-time-access-guard';
import { HoldTimeDetailView } from '@/components/cpv/hold-time-monitoring/hold-time-detail-view';

export const dynamic = 'force-dynamic';

export default async function HoldTimeDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <HoldTimeAccessGuard>
      <HoldTimeDetailView id={params.id} />
    </HoldTimeAccessGuard>
  );
}
