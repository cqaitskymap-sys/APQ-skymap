import { ProcessCapabilityAccessGuard } from '@/components/cpv/process-capability/process-capability-access-guard';
import { ProcessCapabilityDetailView } from '@/components/cpv/process-capability/process-capability-detail-view';

export const dynamic = 'force-dynamic';

export default async function ProcessCapabilityDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <ProcessCapabilityAccessGuard>
      <ProcessCapabilityDetailView id={params.id} />
    </ProcessCapabilityAccessGuard>
  );
}
