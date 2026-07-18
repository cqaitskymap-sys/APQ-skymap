import { YieldAccessGuard } from '@/components/cpv/yield-monitoring/yield-access-guard';
import { YieldDetailView } from '@/components/cpv/yield-monitoring/yield-detail-view';

export default async function YieldDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <YieldAccessGuard>
      <YieldDetailView id={params.id} />
    </YieldAccessGuard>
  );
}
