import { AlertEngineAccessGuard } from '@/components/cpv/alert-engine/alert-engine-access-guard';
import { AlertEngineDetailView } from '@/components/cpv/alert-engine/alert-engine-detail-view';

export const dynamic = 'force-dynamic';

export default function AlertEngineDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <AlertEngineAccessGuard>
      <AlertEngineDetailView id={params.id} />
    </AlertEngineAccessGuard>
  );
}
