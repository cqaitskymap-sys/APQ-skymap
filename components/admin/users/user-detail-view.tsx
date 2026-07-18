'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { RoleBadge } from './role-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditUsers } from '@/lib/permissions';
import type { AdminUser } from '@/lib/admin/schemas';
import { emptyPermissionMatrix, type PermissionMatrixData } from '@/lib/permission-presets';
import { getUserPermissionRecord } from '@/services/permissionService';
import { UserAccessControl } from './user-access-control';
import {
  fetchUserById, fetchUserLoginActivity, fetchUserAuditTrail,
} from '@/lib/admin/user-service';

interface UserDetailViewProps {
  userId: string;
}

export function UserDetailView({ userId }: UserDetailViewProps) {
  const router = useRouter();
  const { role, hasPermission } = useAdminPermissions();
  const canEdit = canEditUsers(role) && hasPermission('Admin', 'edit');

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loginActivity, setLoginActivity] = useState<Record<string, unknown>[]>([]);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrixData>(emptyPermissionMatrix());
  const [permissionPreset, setPermissionPreset] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const u = await fetchUserById(userId, true);
        if (!u) {
          setError('User not found');
          return;
        }
        setUser(u);
        const [logins, audits, permissions] = await Promise.all([
          fetchUserLoginActivity(u.authUid || u.id || '', u.email),
          fetchUserAuditTrail(u.id || ''),
          getUserPermissionRecord(u.authUid || u.id || ''),
        ]);
        setLoginActivity(logins);
        setAuditTrail(audits);
        setPermissionMatrix(permissions?.customPermissions || permissions?.modulePermissions || emptyPermissionMatrix());
        setPermissionPreset(permissions?.presetId || '');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error || !user) return <ErrorCard title="User Not Found" message={error || 'User does not exist'} />;

  const fields: { label: string; value: string | boolean | null | undefined }[] = [
    { label: 'User ID', value: user.userId || user.id },
    { label: 'Employee ID', value: user.employeeId },
    { label: 'Employee Code', value: user.employeeCode },
    { label: 'Username', value: user.username },
    { label: 'First Name', value: user.firstName },
    { label: 'Middle Name', value: user.middleName },
    { label: 'Last Name', value: user.lastName },
    { label: 'Full Name', value: user.fullName },
    { label: 'Email', value: user.email },
    { label: 'Phone', value: user.mobileNumber },
    { label: 'Alternate Mobile', value: user.alternateMobile },
    { label: 'Gender', value: user.gender },
    { label: 'Date of Birth', value: user.dateOfBirth },
    { label: 'Department', value: user.department },
    { label: 'Designation', value: user.designation },
    { label: 'Role', value: user.role },
    { label: 'Reporting Manager', value: user.reportingManager },
    { label: 'Business Unit', value: user.businessUnit },
    { label: 'Site', value: user.siteName || user.siteId },
    { label: 'Location', value: user.location },
    { label: 'Shift', value: user.shift },
    { label: 'Employment Type', value: user.employmentType },
    { label: 'Joining Date', value: user.joiningDate },
    { label: 'Status', value: user.userStatus },
    { label: 'Account Locked', value: user.accountLocked },
    { label: 'Password Reset Required', value: user.passwordResetRequired },
    { label: 'Two Factor Enabled', value: user.twoFactorEnabled },
    { label: 'Email Verified', value: user.emailVerified },
    { label: 'Remarks', value: user.remarks },
    { label: 'Last Login', value: user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '-' },
    { label: 'Created At', value: user.createdAt ? new Date(user.createdAt).toLocaleString() : '-' },
    { label: 'Updated At', value: user.updatedAt ? new Date(user.updatedAt).toLocaleString() : '-' },
    { label: 'Created By', value: user.createdBy },
    { label: 'Updated By', value: user.updatedBy },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/users')}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
      </div>

      <PageHeader
        title={user.fullName}
        description={user.email}
        basePath="/admin"
        actions={
          canEdit && !user.isDeleted ? (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/admin/users/${user.id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit User</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={user.userStatus} />
        <RoleBadge role={user.role} />
        {user.accountLocked && <StatusBadge status="Locked" />}
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="sessions">Session History</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle className="text-base">Profile Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {fields.map((field) => (
                  <div key={field.label} className="border-b pb-2">
                    <p className="text-xs text-muted-foreground">{field.label}</p>
                    <p className="text-sm font-medium mt-0.5 break-words">
                      {typeof field.value === 'boolean' ? (field.value ? 'Yes' : 'No') : String(field.value || '-')}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader><CardTitle className="text-base">Login and Account Activity</CardTitle></CardHeader>
            <CardContent>
              {loginActivity.length === 0 ? <EmptyState message="No login records for this user." /> : (
                <div className="space-y-2 text-sm">
                  {loginActivity.map((entry, index) => (
                    <div key={String(entry.id || index)} className="p-3 border rounded-lg">
                      <p className="font-medium">{String(entry.loginStatus || entry.status || 'Login event')}</p>
                      <p>{String(entry.loginTime || entry.createdAt || '-')}</p>
                      <p className="text-xs text-muted-foreground">{String(entry.ipAddress || 'Unknown IP')} · {String(entry.deviceInfo || 'Unknown device')}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader><CardTitle className="text-base">Effective User Overrides</CardTitle></CardHeader>
            <CardContent>
              <UserAccessControl
                value={permissionMatrix}
                onChange={setPermissionMatrix}
                presetId={permissionPreset}
                onPresetChange={setPermissionPreset}
                readOnly
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader><CardTitle className="text-base">Immutable Audit Trail</CardTitle></CardHeader>
            <CardContent>
              {auditTrail.length === 0 ? <EmptyState message="No audit events for this user record." /> : (
                <div className="space-y-2 text-sm max-h-[32rem] overflow-y-auto">
                  {auditTrail.map((entry, index) => (
                    <div key={String(entry.id || index)} className="p-3 border rounded-lg">
                      <p className="font-medium">{String(entry.action || entry.actionType || 'User event')}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(entry.timestamp || entry.dateTime || '-')} — {String(entry.userName || entry.userId || 'System')}
                      </p>
                      {entry.reason ? <p className="mt-1 text-xs">Reason: {String(entry.reason)}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader><CardTitle className="text-base">Session History</CardTitle></CardHeader>
            <CardContent>
              {loginActivity.length === 0 ? <EmptyState message="No session history for this user." /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left"><th className="py-2">Login</th><th>Logout</th><th>Status</th><th>Device / IP</th></tr></thead>
                    <tbody>
                      {loginActivity.map((entry, index) => (
                        <tr key={String(entry.id || index)} className="border-b">
                          <td className="py-2">{String(entry.loginTime || '-')}</td>
                          <td>{String(entry.logoutTime || 'Active / not recorded')}</td>
                          <td>{String(entry.loginStatus || entry.status || '-')}</td>
                          <td>{String(entry.deviceInfo || '-')} · {String(entry.ipAddress || '-')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
