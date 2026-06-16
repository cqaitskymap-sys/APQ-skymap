'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserAccessGuard } from '@/components/admin/users/user-access-guard';
import { UserForm } from '@/components/admin/users/user-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditUsers } from '@/lib/permissions';
import { createSystemUser } from '@/lib/admin/user-service';
import type { AdminUser } from '@/lib/admin/schemas';

function CreateUserContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const [submitting, setSubmitting] = useState(false);

  if (!canEditUsers(role)) {
    return <ErrorCard accessDenied title="Access Denied" message="Only Super Admin and Admin can create users." />;
  }

  const onSubmit = async (data: AdminUser, tempPassword?: string) => {
    setSubmitting(true);
    const result = await createSystemUser(data, tempPassword || '', {
      userId: user?.uid || 'system',
      userName: profile?.full_name || profile?.email || 'Admin',
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('User created successfully');
    router.push(`/admin/users/${result.user?.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create User"
        description="Add a new user to the Pharma QMS system"
        basePath="/admin"
      />
      <Card>
        <CardHeader><CardTitle className="text-base">User Information</CardTitle></CardHeader>
        <CardContent>
          <UserForm
            isCreate
            onSubmit={onSubmit}
            onCancel={() => router.push('/admin/users')}
            submitting={submitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function CreateUserPage() {
  return (
    <UserAccessGuard>
      <CreateUserContent />
    </UserAccessGuard>
  );
}
