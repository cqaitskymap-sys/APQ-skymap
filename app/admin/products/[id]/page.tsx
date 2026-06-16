'use client';

import { ProductAccessGuard } from '@/components/admin/products/product-access-guard';
import { ProductDetailView } from '@/components/admin/products/product-detail-view';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  return (
    <ProductAccessGuard>
      <ProductDetailView id={params.id} />
    </ProductAccessGuard>
  );
}
