import { HoldTimeAccessGuard } from '@/components/cpv/hold-time-monitoring/hold-time-access-guard';
import { HoldTimeDetailView } from '@/components/cpv/hold-time-monitoring/hold-time-detail-view';

export const dynamic = 'force-dynamic';

export default function HoldTimeDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <HoldTimeAccessGuard>
      <HoldTimeDetailView id={params.id} />
    </HoldTimeAccessGuard>
  );
}
