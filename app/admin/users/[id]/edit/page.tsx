'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserAccessGuard } from '@/components/admin/users/user-access-guard';
import { UserForm } from '@/components/admin/users/user-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditUsers } from '@/lib/permissions';
import {
  fetchUserById, updateSystemUser, canModifyTargetUser,
} from '@/lib/admin/user-service';
import type { AdminUser } from '@/lib/admin/schemas';

function EditUserContent({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const [existing, setExisting] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUserById(id).then((u) => {
      setExisting(u);
      setLoading(false);
    });
  }, [id]);

  if (!canEditUsers(role)) {
    return <ErrorCard accessDenied title="Access Denied" message="Only Super Admin and Admin can edit users." />;
  }

  if (loading) return <LoadingSkeleton rows={1} />;
  if (!existing) return <ErrorCard title="Not Found" message="User not found" />;

  const modifyCheck = canModifyTargetUser(role, user?.uid || '', existing);
  if (!modifyCheck.allowed) {
    return <ErrorCard accessDenied title="Action Not Allowed" message={modifyCheck.reason} />;
  }

  const onSubmit = async (data: AdminUser) => {
    setSubmitting(true);
    const result = await updateSystemUser(existing.id!, data, existing, {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('User updated');
    router.push(`/admin/users/${id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Edit User" description={existing.fullName} basePath="/admin" />
      <Card>
        <CardHeader><CardTitle className="text-base">Update User Information</CardTitle></CardHeader>
        <CardContent>
          <UserForm
            initial={existing}
            onSubmit={onSubmit}
            onCancel={() => router.push(`/admin/users/${id}`)}
            submitting={submitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function EditUserPage({ params }: { params: { id: string } }) {
  return (
    <UserAccessGuard>
      <EditUserContent id={params.id} />
    </UserAccessGuard>
  );
}
