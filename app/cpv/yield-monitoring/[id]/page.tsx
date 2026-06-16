import { YieldAccessGuard } from '@/components/cpv/yield-monitoring/yield-access-guard';
import { YieldDetailView } from '@/components/cpv/yield-monitoring/yield-detail-view';

export default function YieldDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <YieldAccessGuard>
      <YieldDetailView id={params.id} />
    </YieldAccessGuard>
  );
}
