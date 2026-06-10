'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, UserX, UserCheck, Key, History } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminDataTable, StatusBadge, ColumnDef } from '@/components/admin/admin-data-table';
import { PermissionGate } from '@/components/admin/permission-gate';
import { AdminAuthGuard } from '@/components/admin/admin-auth-guard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord, checkUniqueField, getAuditLogs,
} from '@/lib/admin/admin-service';
import { ADMIN_COLLECTIONS, ADMIN_ROLES, USER_STATUSES } from '@/lib/admin/constants';
import { adminUserSchema, type AdminUser } from '@/lib/admin/schemas';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, firestore } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const defaultUser: Partial<AdminUser> = {
  employeeId: '', fullName: '', email: '', mobileNumber: '', department: '',
  designation: '', role: 'qa_executive', reportingManager: '', userStatus: 'Active',
  profilePhoto: '', joiningDate: '', passwordResetRequired: false, twoFactorEnabled: false,
  status: 'Active',
};

export default function AdminUsersPage() {
  return (
    <AdminAuthGuard requireManageUsers>
      <UsersContent />
    </AdminAuthGuard>
  );
}

function UsersContent() {
  const { user, profile } = useAuth();
  const { isReadOnly } = useAdminPermissions();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [activityLogs, setActivityLogs] = useState<ReturnType<typeof Array.prototype.slice>>([]);

  const form = useForm<AdminUser>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: defaultUser as AdminUser,
  });

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || 'Admin',
    module: 'Admin' as const,
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const data = await getAdminRecords<AdminUser>(ADMIN_COLLECTIONS.users);
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const columns: ColumnDef<AdminUser>[] = [
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'fullName', header: 'Full Name' },
    { key: 'email', header: 'Email' },
    { key: 'department', header: 'Department' },
    { key: 'role', header: 'Role', render: (r) => r.role?.replace(/_/g, ' ') },
    { key: 'userStatus', header: 'Status', render: (r) => <StatusBadge status={r.userStatus} /> },
    { key: 'lastLogin', header: 'Last Login', render: (r) => r.lastLogin ? new Date(r.lastLogin).toLocaleDateString() : '-' },
  ];

  const onSubmit = async (data: AdminUser) => {
    try {
      const emailUnique = await checkUniqueField(ADMIN_COLLECTIONS.users, 'email', data.email, editing?.id);
      const empUnique = await checkUniqueField(ADMIN_COLLECTIONS.users, 'employeeId', data.employeeId, editing?.id);
      if (!emailUnique) { form.setError('email', { message: 'Email already exists' }); return; }
      if (!empUnique) { form.setError('employeeId', { message: 'Employee ID already exists' }); return; }

      if (editing?.id) {
        await updateAdminRecord(ADMIN_COLLECTIONS.users, editing.id, data, auditMeta);
        if (editing.authUid) {
          await setDoc(doc(firestore, 'profiles', editing.authUid), {
            full_name: data.fullName, email: data.email, role: data.role,
            department: data.department, employee_id: data.employeeId,
            is_active: data.userStatus === 'Active', updated_at: new Date().toISOString(),
          }, { merge: true });
        }
        toast.success('User updated');
      } else {
        if (!tempPassword || tempPassword.length < 8) {
          toast.error('Temporary password required (min 8 characters)');
          return;
        }
        const authResult = await createUserWithEmailAndPassword(auth, data.email, tempPassword);
        const uid = authResult.user.uid;
        await setDoc(doc(firestore, 'profiles', uid), {
          id: uid, full_name: data.fullName, email: data.email, role: data.role,
          department: data.department, employee_id: data.employeeId, phone: data.mobileNumber,
          is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
        await createAdminRecord(ADMIN_COLLECTIONS.users, { ...data, authUid: uid }, auditMeta);
        toast.success('User created. Note: you may need to re-login as admin.');
      }
      setDrawerOpen(false);
      setTempPassword('');
      loadUsers();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save user');
    }
  };

  const toggleStatus = async (u: AdminUser, status: AdminUser['userStatus']) => {
    if (!u.id) return;
    await updateAdminRecord(ADMIN_COLLECTIONS.users, u.id, { userStatus: status }, auditMeta);
    toast.success(`User ${status}`);
    loadUsers();
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent');
    } catch {
      toast.error('Failed to send reset email');
    }
  };

  const viewActivity = async (userId: string) => {
    const logs = await getAuditLogs({ userId });
    setActivityLogs(logs as never[]);
  };

  const active = users.filter((u) => u.userStatus === 'Active').length;
  const inactive = users.filter((u) => u.userStatus === 'Inactive').length;

  return (
    <div>
      <AdminPageHeader
        title="User Management"
        description="Create, manage, and control user access across the QMS platform"
        actions={
          !isReadOnly && (
            <PermissionGate module="Admin" action="create">
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditing(null); form.reset(defaultUser as AdminUser); setDrawerOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />Create User
              </Button>
            </PermissionGate>
          )
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Users</p><p className="text-2xl font-bold">{users.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-600">{active}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Inactive</p><p className="text-2xl font-bold text-slate-500">{inactive}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending Approval</p><p className="text-2xl font-bold text-amber-600">{users.filter(u => u.userStatus === 'Pending Approval').length}</p></CardContent></Card>
      </div>

      <AdminDataTable
        columns={columns}
        data={users}
        loading={loading}
        searchKeys={['fullName', 'email', 'employeeId', 'department']}
        actions={(row) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => { setEditing(row); form.reset(row); setDrawerOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            {row.userStatus === 'Active'
              ? <Button variant="ghost" size="icon" onClick={() => toggleStatus(row, 'Inactive')}><UserX className="h-4 w-4 text-amber-500" /></Button>
              : <Button variant="ghost" size="icon" onClick={() => toggleStatus(row, 'Active')}><UserCheck className="h-4 w-4 text-green-500" /></Button>}
            <Button variant="ghost" size="icon" onClick={() => resetPassword(row.email)}><Key className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => viewActivity(row.authUid || row.id || '')}><History className="h-4 w-4" /></Button>
          </div>
        )}
      />

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? 'Edit User' : 'Create User'}</SheetTitle></SheetHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Employee ID *</Label><Input {...form.register('employeeId')} /></div>
              <div className="space-y-2"><Label>Full Name *</Label><Input {...form.register('fullName')} /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" {...form.register('email')} /></div>
              <div className="space-y-2"><Label>Mobile</Label><Input {...form.register('mobileNumber')} /></div>
              <div className="space-y-2"><Label>Department *</Label><Input {...form.register('department')} /></div>
              <div className="space-y-2"><Label>Designation</Label><Input {...form.register('designation')} /></div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={form.watch('role')} onValueChange={(v) => form.setValue('role', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ADMIN_ROLES.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Reporting Manager</Label><Input {...form.register('reportingManager')} /></div>
              <div className="space-y-2"><Label>Joining Date</Label><Input type="date" {...form.register('joiningDate')} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.watch('userStatus')} onValueChange={(v) => form.setValue('userStatus', v as AdminUser['userStatus'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{USER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!editing && (
                <div className="space-y-2 col-span-2"><Label>Temporary Password *</Label><Input type="password" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} placeholder="Min 8 characters" /></div>
              )}
              <div className="flex items-center justify-between"><Label>Password Reset Required</Label><Switch checked={form.watch('passwordResetRequired')} onCheckedChange={(v) => form.setValue('passwordResetRequired', v)} /></div>
              <div className="flex items-center justify-between"><Label>Two Factor Enabled</Label><Switch checked={form.watch('twoFactorEnabled')} onCheckedChange={(v) => form.setValue('twoFactorEnabled', v)} /></div>
            </div>
            <SheetFooter><Button type="submit" className="bg-blue-600">{editing ? 'Update' : 'Create'}</Button></SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {activityLogs.length > 0 && (
        <div className="mt-6 p-4 border rounded-lg bg-white">
          <h3 className="font-semibold mb-2">Activity Log ({activityLogs.length} events)</h3>
          <div className="max-h-48 overflow-y-auto text-sm space-y-1">
            {(activityLogs as { action: string; module: string; dateTime: string }[]).slice(0, 20).map((log, i) => (
              <p key={i} className="text-muted-foreground">{new Date(log.dateTime).toLocaleString()} — {log.action} — {log.module}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
