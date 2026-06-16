import { ProcessCapabilityAccessGuard } from '@/components/cpv/process-capability/process-capability-access-guard';
import { ProcessCapabilityDetailView } from '@/components/cpv/process-capability/process-capability-detail-view';

export const dynamic = 'force-dynamic';

export default function ProcessCapabilityDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <ProcessCapabilityAccessGuard>
      <ProcessCapabilityDetailView id={params.id} />
    </ProcessCapabilityAccessGuard>
  );
}
