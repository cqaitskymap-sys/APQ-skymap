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
  fetchRoleWithPermissions, updateRole, canModifyRole, countUsersWithRole,
} from '@/lib/admin/role-service';
import type { RoleFormData } from '@/lib/admin/schemas';

function EditRoleContent({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role: currentRole, hasPermission } = useAdminPermissions();
  const [initial, setInitial] = useState<RoleFormData | null>(null);
  const [existingRole, setExistingRole] = useState<Awaited<ReturnType<typeof fetchRoleWithPermissions>>['role']>(null);
  const [existingPerms, setExistingPerms] = useState<Awaited<ReturnType<typeof fetchRoleWithPermissions>>['permissions']>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingData, setPendingData] = useState<RoleFormData | null>(null);
  const [affectedUsers, setAffectedUsers] = useState(0);

  useEffect(() => {
    fetchRoleWithPermissions(id).then(async ({ role, permissions }) => {
      if (!role || role.isDeleted) {
        setLoading(false);
        return;
      }
      setExistingRole(role);
      setExistingPerms(permissions);
      setAffectedUsers(await countUsersWithRole(role.roleId));
      setInitial({
        roleId: role.roleId,
        roleName: role.roleName,
        roleDescription: role.roleDescription || role.description || '',
        roleLevel: role.roleLevel ?? role.level ?? 10,
        departmentAccess: role.departmentAccess || '',
        siteAccess: role.siteAccess || '',
        businessUnitAccess: role.businessUnitAccess || '',
        dataScope: role.dataScope || 'Organization Records',
        fieldPolicies: role.fieldPolicies || [],
        status: (role.status as RoleFormData['status']) || 'Active',
        permissions: permissions?.permissions || buildDefaultRoleMatrix(role.roleId),
        changeReason: '',
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (!canEditRoles(currentRole) || !hasPermission('Admin', 'edit')) {
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
      { userId: user?.uid || 'system', userName: profile?.full_name || profile?.email || 'Admin', role: currentRole },
      currentRole,
    );
    setSubmitting(false);
    setPendingData(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.affectedUsers} user(s) will receive updated access on next session refresh`);
    router.push(`/admin/roles/${id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Role" description={existingRole.roleName} basePath="/admin" />
      <RoleForm
        initial={initial}
        isSuperAdminRole={existingRole.roleId === 'super_admin'}
        onSubmit={(data) => setPendingData(data)}
        onCancel={() => router.push(`/admin/roles/${id}`)}
        submitting={submitting}
      />
      <AlertDialog open={!!pendingData} onOpenChange={() => !submitting && setPendingData(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Permission Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Save permission changes for &quot;{pendingData?.roleName}&quot;?
              Approximately {affectedUsers} assigned user(s) will receive updated access on their next session.
              Reason: {pendingData?.changeReason}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600"
              disabled={submitting}
              onClick={() => pendingData && confirmSave(pendingData)}
            >
              {submitting ? 'Saving…' : 'Save Changes'}
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
