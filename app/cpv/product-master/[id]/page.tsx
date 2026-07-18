import { CpvProductAccessGuard } from '@/components/cpv/product-master/cpv-product-access-guard';
import { CpvProductDetailView } from '@/components/cpv/product-master/cpv-product-detail-view';

export default async function CpvProductDetailRoutePage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  return (
    <CpvProductAccessGuard>
      <CpvProductDetailView id={params.id} />
    </CpvProductAccessGuard>
  );
}
