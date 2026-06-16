'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DosageFormBadge } from './dosage-form-badge';
import { ProductStatusBadge } from './product-status-badge';
import { CompositionTable } from './composition-table';
import { PackingTable } from './packing-table';
import { ProductAttachmentsSection } from './product-attachments-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditProducts, canUploadProductAttachments } from '@/lib/permissions';
import type { AdminProduct, ProductAttachment } from '@/lib/admin/schemas';
import {
  fetchProductById, fetchProductCompositions, fetchProductPacking,
  fetchProductAttachments, fetchProductAuditTrail,
} from '@/lib/admin/product-service';

export function ProductDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditProducts(role);
  const canUpload = canUploadProductAttachments(role);

  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [compositions, setCompositions] = useState<Awaited<ReturnType<typeof fetchProductCompositions>>>([]);
  const [packing, setPacking] = useState<Awaited<ReturnType<typeof fetchProductPacking>>>([]);
  const [attachments, setAttachments] = useState<ProductAttachment[]>([]);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = useCallback(async () => {
    try {
      const p = await fetchProductById(id);
      if (!p) {
        setError('Product not found');
        return;
      }
      setProduct(p);
      setCompositions(await fetchProductCompositions(id));
      setPacking(await fetchProductPacking(id));
      setAttachments(await fetchProductAttachments(id));
      setAuditTrail(await fetchProductAuditTrail(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error || !product) return <ErrorCard title="Not Found" message={error || 'Product not found'} />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/admin/products')}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Products
      </Button>

      <PageHeader
        title={product.productName}
        description={product.productId || product.productCode}
        basePath="/admin"
        actions={
          canEdit ? (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/admin/products/${id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit Product</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <ProductStatusBadge status={product.productStatus} />
        <DosageFormBadge form={product.dosageForm} />
        {product.productStatus !== 'Active' && (
          <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            <AlertTriangle className="h-3 w-3" />
            Inactive — new PQR/CPV records blocked
          </span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Product Profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Product Code', value: product.productCode },
            { label: 'Generic Name', value: product.genericName },
            { label: 'Brand Name', value: product.brandName },
            { label: 'Strength', value: product.strength },
            { label: 'Route', value: product.routeOfAdministration },
            { label: 'Market', value: product.market },
            { label: 'Shelf Life (months)', value: product.shelfLife },
            { label: 'Storage', value: product.storageCondition },
            { label: 'Batch Size', value: product.standardBatchSize },
            { label: 'Mfg License', value: product.manufacturingLicenseNumber },
            { label: 'MFR', value: product.mfrNumber },
            { label: 'BMR / BPR', value: `${product.bmrNumber || '-'} / ${product.bprNumber || '-'}` },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{String(f.value ?? '-')}</p>
            </div>
          ))}
          {product.remarks && (
            <div className="sm:col-span-2 md:col-span-3">
              <p className="text-xs text-muted-foreground">Remarks</p>
              <p className="font-medium">{product.remarks}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Composition</CardTitle></CardHeader>
        <CardContent>
          <CompositionTable rows={compositions} onChange={() => {}} readOnly />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Packing Details</CardTitle></CardHeader>
        <CardContent>
          <PackingTable rows={packing} onChange={() => {}} readOnly />
        </CardContent>
      </Card>

      <ProductAttachmentsSection
        productId={id}
        attachments={attachments}
        canUpload={canUpload}
        auditMeta={auditMeta}
        onRefresh={load}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          {auditTrail.length === 0 ? (
            <EmptyState message="No audit events for this product." />
          ) : (
            <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
              {auditTrail.map((l, i) => (
                <div key={i} className="p-2 border rounded">
                  <p className="font-medium">{String(l.action)}</p>
                  <p className="text-xs text-muted-foreground">{String(l.timestamp || l.dateTime)} — {String(l.userName || '')}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
