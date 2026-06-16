import { ProcessCapabilityAccessGuard } from '@/components/cpv/process-capability/process-capability-access-guard';
import { ProcessCapabilityPage } from '@/components/cpv/process-capability/process-capability-page';

export const dynamic = 'force-dynamic';

export default function ProcessCapabilityRoutePage() {
  return (
    <ProcessCapabilityAccessGuard>
      <ProcessCapabilityPage />
    </ProcessCapabilityAccessGuard>
  );
}
