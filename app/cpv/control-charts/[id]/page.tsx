import { SpcAccessGuard } from '@/components/cpv/statistical-process-control/spc-access-guard';
import { SpcDetailView } from '@/components/cpv/statistical-process-control/spc-detail-view';

export const dynamic = 'force-dynamic';

export default function ControlChartsDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <SpcAccessGuard>
      <SpcDetailView id={params.id} />
    </SpcAccessGuard>
  );
}
