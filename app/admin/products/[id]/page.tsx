'use client';;
import { use } from "react";

import { ProductAccessGuard } from '@/components/admin/products/product-access-guard';
import { ProductDetailView } from '@/components/admin/products/product-detail-view';

export default function ProductDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <ProductAccessGuard>
      <ProductDetailView id={params.id} />
    </ProductAccessGuard>
  );
}
