import { CppAccessGuard } from '@/components/cpv/cpp-monitoring/cpp-access-guard';
import { CppResultDetailView } from '@/components/cpv/cpp-monitoring/cpp-result-detail-view';

export default function CppResultDetailRoutePage({ params }: { params: { id: string } }) {
  return (
    <CppAccessGuard>
      <CppResultDetailView id={params.id} />
    </CppAccessGuard>
  );
}
