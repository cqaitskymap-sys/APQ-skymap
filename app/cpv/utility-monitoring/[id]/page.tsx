import { UtilityAccessGuard } from '@/components/cpv/utility-monitoring/utility-access-guard';
import { UtilityDetailView } from '@/components/cpv/utility-monitoring/utility-detail-view';

export default async function UtilityDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <UtilityAccessGuard>
      <UtilityDetailView id={params.id} />
    </UtilityAccessGuard>
  );
}
