'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ProductAccessGuard } from '@/components/admin/products/product-access-guard';
import { ProductForm } from '@/components/admin/products/product-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditProducts } from '@/lib/permissions';
import {
  fetchProductById, fetchProductCompositions, fetchProductPacking, updateProduct,
} from '@/lib/admin/product-service';
import type { ProductFormData } from '@/lib/admin/schemas';

function EditProductContent({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const [initial, setInitial] = useState<ProductFormData | null>(null);
  const [existing, setExisting] = useState<Awaited<ReturnType<typeof fetchProductById>>>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<ProductFormData | null>(null);

  useEffect(() => {
    fetchProductById(id).then(async (p) => {
      if (!p) {
        setLoading(false);
        return;
      }
      const [comps, pack] = await Promise.all([
        fetchProductCompositions(id),
        fetchProductPacking(id),
      ]);
      setExisting(p);
      setInitial({
        productCode: p.productCode,
        productName: p.productName,
        genericName: p.genericName || '',
        brandName: p.brandName || '',
        strength: p.strength || '',
        dosageForm: (p.dosageForm as ProductFormData['dosageForm']) || 'Other',
        routeOfAdministration: p.routeOfAdministration || '',
        packSize: p.packSize || '',
        market: (p.market as ProductFormData['market']) || 'Domestic',
        therapeuticCategory: p.therapeuticCategory || '',
        shelfLife: p.shelfLife || '',
        storageCondition: p.storageCondition || '',
        standardBatchSize: p.standardBatchSize || p.batchSize || '',
        manufacturingLicenseNumber: p.manufacturingLicenseNumber || p.manufacturingLicenseNo || '',
        mfrNumber: p.mfrNumber || '',
        bmrNumber: p.bmrNumber || '',
        bprNumber: p.bprNumber || '',
        specificationNumber: p.specificationNumber || '',
        stpNumber: p.stpNumber || '',
        productStatus: (p.productStatus as ProductFormData['productStatus']) || 'Active',
        remarks: p.remarks || '',
        compositions: comps.length ? comps : [{
          ingredientName: 'API', ingredientType: 'API', grade: '', quantity: 1, unit: 'mg',
          functionPurpose: '', specificationNo: '', stpNo: '',
        }],
        packingDetails: pack,
      });
      setLoading(false);
    });
  }, [id]);

  if (!canEditProducts(role)) {
    return <ErrorCard accessDenied message="You do not have permission to edit products." />;
  }

  if (loading) return <LoadingSkeleton rows={1} />;
  if (!initial || !existing) return <ErrorCard title="Not Found" message="Product not found" />;

  const confirmSave = async (data: ProductFormData) => {
    setSubmitting(true);
    const result = await updateProduct(id, data, existing, {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Product updated');
    router.push(`/admin/products/${id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Product" description={existing.productName} basePath="/admin" />
      <ProductForm
        initial={initial}
        onSubmit={(data) => setPending(data)}
        onCancel={() => router.push(`/admin/products/${id}`)}
        submitting={submitting}
      />
      <AlertDialog open={!!pending} onOpenChange={() => setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
            <AlertDialogDescription>Save changes to &quot;{pending?.productName}&quot;?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-blue-600" onClick={() => pending && confirmSave(pending)}>Save Changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function EditProductPage({ params }: { params: { id: string } }) {
  return (
    <ProductAccessGuard>
      <EditProductContent id={params.id} />
    </ProductAccessGuard>
  );
}
