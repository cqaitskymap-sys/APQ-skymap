import { CppAccessGuard } from '@/components/cpv/cpp-monitoring/cpp-access-guard';
import { CppResultDetailView } from '@/components/cpv/cpp-monitoring/cpp-result-detail-view';

export default async function CppResultDetailRoutePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <CppAccessGuard>
      <CppResultDetailView id={params.id} />
    </CppAccessGuard>
  );
}
