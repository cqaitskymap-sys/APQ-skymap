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
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditUsers } from '@/lib/permissions';
import type { AdminUser } from '@/lib/admin/schemas';
import {
  fetchUserById, fetchUserLoginActivity, fetchUserAuditTrail,
} from '@/lib/admin/user-service';

interface UserDetailViewProps {
  userId: string;
}

export function UserDetailView({ userId }: UserDetailViewProps) {
  const router = useRouter();
  const { role } = useAdminPermissions();
  const canEdit = canEditUsers(role);

  const [user, setUser] = useState<AdminUser | null>(null);
  const [loginActivity, setLoginActivity] = useState<Record<string, unknown>[]>([]);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const u = await fetchUserById(userId);
        if (!u) {
          setError('User not found');
          return;
        }
        setUser(u);
        const [logins, audits] = await Promise.all([
          fetchUserLoginActivity(u.authUid || u.id || '', u.email),
          fetchUserAuditTrail(u.id || ''),
        ]);
        setLoginActivity(logins);
        setAuditTrail(audits);
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
    { label: 'Full Name', value: user.fullName },
    { label: 'Email', value: user.email },
    { label: 'Phone', value: user.mobileNumber },
    { label: 'Department', value: user.department },
    { label: 'Designation', value: user.designation },
    { label: 'Role', value: user.role },
    { label: 'Reporting Manager', value: user.reportingManager },
    { label: 'Status', value: user.userStatus },
    { label: 'Account Locked', value: user.accountLocked },
    { label: 'Password Reset Required', value: user.passwordResetRequired },
    { label: 'Two Factor Enabled', value: user.twoFactorEnabled },
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
          canEdit ? (
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

      <Card>
        <CardHeader><CardTitle className="text-base">Profile Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.map((f) => (
              <div key={f.label} className="border-b pb-2">
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-sm font-medium mt-0.5">
                  {typeof f.value === 'boolean' ? (f.value ? 'Yes' : 'No') : String(f.value ?? '-')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Login Activity</CardTitle></CardHeader>
          <CardContent>
            {loginActivity.length === 0 ? (
              <EmptyState message="No login records for this user." />
            ) : (
              <div className="space-y-2 text-sm">
                {loginActivity.map((l, i) => (
                  <div key={i} className="p-2 border rounded">
                    <p>{String(l.loginTime || l.createdAt)}</p>
                    <p className="text-xs text-muted-foreground">{String(l.ipAddress)} · {String(l.loginStatus || l.status)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
          <CardContent>
            {auditTrail.length === 0 ? (
              <EmptyState message="No audit events for this user record." />
            ) : (
              <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
                {auditTrail.map((l, i) => (
                  <div key={i} className="p-2 border rounded">
                    <p className="font-medium">{String(l.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      {String(l.timestamp || l.dateTime)} — {String(l.userName || l.userId)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
