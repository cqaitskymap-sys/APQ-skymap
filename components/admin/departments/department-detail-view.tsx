'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, AlertTriangle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { DepartmentTypeBadge } from './department-type-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditDepartments } from '@/lib/permissions';
import type { AdminUser, Department } from '@/lib/admin/schemas';
import {
  fetchDepartmentById, fetchUsersInDepartment, fetchDepartmentAuditTrail,
  fetchActiveUsers, linkUsersToDepartment,
} from '@/lib/admin/department-service';

export function DepartmentDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditDepartments(role);

  const [dept, setDept] = useState<Department | null>(null);
  const [linkedUsers, setLinkedUsers] = useState<AdminUser[]>([]);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AdminUser[]>([]);
  const [linkUserId, setLinkUserId] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const load = async () => {
    try {
      const department = await fetchDepartmentById(id);
      if (!department) {
        setError('Department not found');
        return;
      }
      setDept(department);
      setLinkedUsers(await fetchUsersInDepartment(department));
      setAuditTrail(await fetchDepartmentAuditTrail(id));
      const active = await fetchActiveUsers();
      setAvailableUsers(active.filter((u) => !departmentMatches(department, u)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  function departmentMatches(d: Department, u: AdminUser) {
    return u.department === d.departmentName || u.department === d.departmentCode;
  }

  useEffect(() => { load(); }, [id]);

  const handleLink = async () => {
    if (!dept || !linkUserId) return;
    const result = await linkUsersToDepartment(dept, [linkUserId], auditMeta);
    if (result.success) {
      toast.success(`${result.count ?? 0} user(s) linked`);
      setLinkOpen(false);
      setLinkUserId('');
      load();
    } else {
      toast.error(result.error || 'Failed to link user');
    }
  };

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error || !dept) return <ErrorCard title="Not Found" message={error || 'Department not found'} />;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/admin/departments')}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Departments
      </Button>

      <PageHeader
        title={dept.departmentName}
        description={dept.departmentId || dept.departmentCode}
        basePath="/admin"
        actions={
          canEdit ? (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/admin/departments/${id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit Department</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <StatusBadge status={dept.status} />
        <DepartmentTypeBadge type={dept.departmentType} />
        <span className="text-sm text-muted-foreground">{linkedUsers.length} linked users</span>
        {dept.status === 'Inactive' && (
          <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            <AlertTriangle className="h-3 w-3" />
            Inactive — new user assignments blocked
          </span>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Department Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Department ID', value: dept.departmentId },
            { label: 'Department Code', value: dept.departmentCode },
            { label: 'Department Head', value: dept.departmentHead },
            { label: 'HOD Email', value: dept.hodEmail },
            { label: 'Site / Location', value: dept.siteLocation },
            { label: 'Created At', value: dept.createdAt ? new Date(dept.createdAt).toLocaleString() : '-' },
            { label: 'Updated At', value: dept.updatedAt ? new Date(dept.updatedAt).toLocaleString() : '-' },
            { label: 'Created By', value: dept.createdBy },
            { label: 'Updated By', value: dept.updatedBy },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{String(f.value ?? '-')}</p>
            </div>
          ))}
          {dept.description && (
            <div className="sm:col-span-2 md:col-span-3">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="font-medium">{dept.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Linked Users</CardTitle>
          {canEdit && dept.status === 'Active' && (
            <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" />Link User
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {linkedUsers.length === 0 ? (
            <EmptyState message="No users linked to this department." />
          ) : (
            <div className="space-y-2">
              {linkedUsers.map((u) => (
                <div key={u.id} className="flex justify-between items-center p-2 border rounded text-sm">
                  <div>
                    <p className="font-medium">{u.fullName}</p>
                    <p className="text-xs text-muted-foreground">{u.email} · {u.employeeId}</p>
                  </div>
                  {dept.status === 'Inactive' && (
                    <span className="text-xs text-amber-600">Inactive dept warning</span>
                  )}
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
            <EmptyState message="No audit events for this department." />
          ) : (
            <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
              {auditTrail.map((l, i) => (
                <div key={i} className="p-2 border rounded">
                  <p className="font-medium">{String(l.action)}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(l.timestamp || l.dateTime)} — {String(l.userName || '')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={linkOpen} onOpenChange={setLinkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link User to Department</AlertDialogTitle>
            <AlertDialogDescription>
              Assign an active user to {dept.departmentName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={linkUserId} onValueChange={setLinkUserId}>
            <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
            <SelectContent>
              {availableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id || u.employeeId}>
                  {u.fullName} ({u.employeeId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLink} className="bg-blue-600">Link User</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
