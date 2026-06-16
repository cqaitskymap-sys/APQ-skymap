import { UtilityAccessGuard } from '@/components/cpv/utility-monitoring/utility-access-guard';
import { UtilityDetailView } from '@/components/cpv/utility-monitoring/utility-detail-view';

export default function UtilityDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <UtilityAccessGuard>
      <UtilityDetailView id={params.id} />
    </UtilityAccessGuard>
  );
}
