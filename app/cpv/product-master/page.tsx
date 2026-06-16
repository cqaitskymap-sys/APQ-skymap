import { CpvProductAccessGuard } from '@/components/cpv/product-master/cpv-product-access-guard';
import { CpvProductMasterListPage } from '@/components/cpv/product-master/cpv-product-master-list-page';

export default function CpvProductMasterRoutePage() {
  return (
    <CpvProductAccessGuard>
      <CpvProductMasterListPage />
    </CpvProductAccessGuard>
  );
}
