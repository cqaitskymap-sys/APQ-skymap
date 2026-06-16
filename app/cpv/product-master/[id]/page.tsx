import { CpvProductAccessGuard } from '@/components/cpv/product-master/cpv-product-access-guard';
import { CpvProductDetailView } from '@/components/cpv/product-master/cpv-product-detail-view';

export default function CpvProductDetailRoutePage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <CpvProductAccessGuard>
      <CpvProductDetailView id={params.id} />
    </CpvProductAccessGuard>
  );
}
