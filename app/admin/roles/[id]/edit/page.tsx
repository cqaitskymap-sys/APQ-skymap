'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RoleAccessGuard } from '@/components/admin/roles/role-access-guard';
import { RoleForm } from '@/components/admin/roles/role-form';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditRoles, buildDefaultRoleMatrix } from '@/lib/permissions';
import {
  fetchRoleWithPermissions, updateRole, canModifyRole,
} from '@/lib/admin/role-service';
import type { RoleFormData } from '@/lib/admin/schemas';

function EditRoleContent({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role: currentRole } = useAdminPermissions();
  const [initial, setInitial] = useState<RoleFormData | null>(null);
  const [existingRole, setExistingRole] = useState<Awaited<ReturnType<typeof fetchRoleWithPermissions>>['role']>(null);
  const [existingPerms, setExistingPerms] = useState<Awaited<ReturnType<typeof fetchRoleWithPermissions>>['permissions']>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingData, setPendingData] = useState<RoleFormData | null>(null);
  const [affectedUsers, setAffectedUsers] = useState(0);

  useEffect(() => {
    fetchRoleWithPermissions(id).then(({ role, permissions }) => {
      if (!role) {
        setLoading(false);
        return;
      }
      setExistingRole(role);
      setExistingPerms(permissions);
      setInitial({
        roleId: role.roleId,
        roleName: role.roleName,
        roleDescription: role.roleDescription || role.description || '',
        roleLevel: role.roleLevel ?? role.level ?? 10,
        departmentAccess: role.departmentAccess || '',
        status: (role.status as RoleFormData['status']) || 'Active',
        permissions: permissions?.permissions || buildDefaultRoleMatrix(role.roleId),
      });
      setLoading(false);
    });
  }, [id]);

  if (!canEditRoles(currentRole)) {
    return <ErrorCard accessDenied message="Only Super Admin and Admin can edit roles." />;
  }

  if (loading) return <LoadingSkeleton rows={1} />;
  if (!initial || !existingRole) return <ErrorCard title="Not Found" message="Role not found" />;

  const modifyCheck = canModifyRole(currentRole, existingRole.roleId);
  if (!modifyCheck.allowed) {
    return <ErrorCard accessDenied message={modifyCheck.reason} />;
  }

  const confirmSave = async (data: RoleFormData) => {
    setSubmitting(true);
    const result = await updateRole(
      id,
      data,
      existingRole,
      existingPerms,
      { userId: user?.uid || 'system', userName: profile?.full_name || profile?.email || 'Admin' },
      currentRole,
    );
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.affectedUsers} user(s) will receive updated access on next login`);
    router.push(`/admin/roles/${id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Role" description={existingRole.roleName} basePath="/admin" />
      <RoleForm
        initial={initial}
        isSuperAdminRole={existingRole.roleId === 'super_admin'}
        onSubmit={(data) => {
          setPendingData(data);
          setAffectedUsers(0);
        }}
        onCancel={() => router.push(`/admin/roles/${id}`)}
        submitting={submitting}
      />
      <AlertDialog open={!!pendingData} onOpenChange={() => setPendingData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Permission Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Save permission changes for &quot;{pendingData?.roleName}&quot;? Affected users will get updated access on their next session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600"
              onClick={() => pendingData && confirmSave(pendingData)}
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function EditRolePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return (
    <RoleAccessGuard>
      <EditRoleContent id={params.id} />
    </RoleAccessGuard>
  );
}
