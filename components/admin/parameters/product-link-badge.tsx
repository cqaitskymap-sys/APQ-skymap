'use client';

import { Badge } from '@/components/ui/badge';

export function ProductLinkBadge({ product }: { product?: string }) {
  if (!product) {
    return <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500">All Products</Badge>;
  }
  return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">{product}</Badge>;
}
