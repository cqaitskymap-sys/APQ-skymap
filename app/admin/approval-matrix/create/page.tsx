'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApprovalMatrixAccessGuard } from '@/components/admin/approval-matrix/approval-matrix-access-guard';
import { ApprovalMatrixForm } from '@/components/admin/approval-matrix/approval-matrix-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditApprovalMatrix } from '@/lib/permissions';
import { createApprovalMatrix } from '@/lib/admin/approval-matrix-service';
import { fetchRoles } from '@/lib/admin/role-service';
import { fetchCompanySites } from '@/lib/admin/department-service';
import { fetchProducts } from '@/lib/admin/product-service';
import type { ApprovalMatrixFormData } from '@/lib/admin/schemas';

function CreateApprovalMatrixContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [sites, setSites] = useState<string[]>([]);
  const [products, setProducts] = useState<{ code: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([fetchRoles(), fetchCompanySites(), fetchProducts()]).then(([r, s, p]) => {
      setRoles(r.map((x) => ({ id: x.roleId || x.id || '', name: x.roleName || x.roleId || '' })));
      setSites(s.map((site) => site.siteName).filter(Boolean));
      setProducts(p.filter((pr) => pr.productStatus === 'Active').map((pr) => ({ code: pr.productCode, name: pr.productName })));
    });
  }, []);

  if (!canEditApprovalMatrix(role)) {
    return <ErrorCard accessDenied message="You do not have permission to create approval matrices." />;
  }

  const onSubmit = async (data: ApprovalMatrixFormData) => {
    setSubmitting(true);
    const result = await createApprovalMatrix(data, {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('Approval matrix created');
    router.push(`/admin/approval-matrix/${result.matrix?.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Create Approval Matrix" description="Define module-wise approval authority" basePath="/admin" />
      <ApprovalMatrixForm
        roles={roles}
        sites={sites}
        products={products}
        onSubmit={onSubmit}
        onCancel={() => router.push('/admin/approval-matrix')}
        submitting={submitting}
      />
    </div>
  );
}

export default function CreateApprovalMatrixPage() {
  return (
    <ApprovalMatrixAccessGuard>
      <CreateApprovalMatrixContent />
    </ApprovalMatrixAccessGuard>
  );
}
