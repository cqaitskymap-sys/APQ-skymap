'use client';

import { ProductAccessGuard } from '@/components/admin/products/product-access-guard';
import { ProductsListPage } from '@/components/admin/products/products-list-page';

export default function AdminProductsPage() {
  return (
    <ProductAccessGuard>
      <ProductsListPage />
    </ProductAccessGuard>
  );
}
