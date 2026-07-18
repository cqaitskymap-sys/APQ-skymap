import { AlertEngineAccessGuard } from '@/components/cpv/alert-engine/alert-engine-access-guard';
import { AlertEngineDetailView } from '@/components/cpv/alert-engine/alert-engine-detail-view';

export const dynamic = 'force-dynamic';

export default async function AlertEngineDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <AlertEngineAccessGuard>
      <AlertEngineDetailView id={params.id} />
    </AlertEngineAccessGuard>
  );
}
