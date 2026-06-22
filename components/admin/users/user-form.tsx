'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ADMIN_ROLES, USER_STATUSES } from '@/lib/admin/constants';
import { adminUserSchema, type AdminUser } from '@/lib/admin/schemas';
import { fetchUserMasters } from '@/lib/admin/user-service';
import { UserAccessControl } from '@/components/admin/users/user-access-control';
import { emptyPermissionMatrix, type PermissionMatrixData } from '@/lib/permission-presets';
import { getUserPermissionRecord } from '@/services/permissionService';

const defaultValues: Partial<AdminUser> = {
  employeeId: '',
  fullName: '',
  email: '',
  mobileNumber: '',
  department: '',
  designation: '',
  role: 'qa_executive',
  reportingManager: '',
  userStatus: 'Active',
  accountLocked: false,
  passwordResetRequired: false,
  twoFactorEnabled: false,
  status: 'Active',
};

export interface UserFormSubmitOptions {
  tempPassword?: string;
  modulePermissions?: PermissionMatrixData;
  presetId?: string;
}

interface UserFormProps {
  initial?: AdminUser | null;
  isCreate?: boolean;
  readOnly?: boolean;
  onSubmit: (data: AdminUser, options?: UserFormSubmitOptions) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

export function UserForm({
  initial,
  isCreate,
  readOnly,
  onSubmit,
  onCancel,
  submitting,
}: UserFormProps) {
  const [tempPassword, setTempPassword] = useState('');
  const [modulePermissions, setModulePermissions] = useState<PermissionMatrixData>(emptyPermissionMatrix());
  const [presetId, setPresetId] = useState('');
  const [masters, setMasters] = useState<{
    departments: { id?: string; departmentName: string; departmentCode: string; status?: string }[];
    designations: { id?: string; designationName: string; designationCode: string; department: string; status?: string }[];
  }>({ departments: [], designations: [] });

  const form = useForm<AdminUser>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: initial || defaultValues,
  });

  useEffect(() => {
    fetchUserMasters().then((m) => setMasters(m));
  }, []);

  useEffect(() => {
    if (initial) form.reset(initial);
  }, [initial, form]);

  useEffect(() => {
    const uid = initial?.authUid || initial?.id;
    if (!uid) return;
    getUserPermissionRecord(uid).then((perms) => {
      if (perms?.customPermissions) {
        setModulePermissions(perms.customPermissions);
        setPresetId(perms.presetId || '');
      } else if (perms?.modulePermissions) {
        setModulePermissions(perms.modulePermissions);
        setPresetId(perms.presetId || '');
      }
    });
  }, [initial?.authUid, initial?.id]);

  const deptDesignations = masters.designations.filter(
    (d) => (d.status === 'Active' || !d.status) &&
      (!form.watch('department') || d.department === form.watch('department')),
  );

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data, {
      tempPassword: isCreate ? tempPassword : undefined,
      modulePermissions,
      presetId: presetId || undefined,
    });
  });

  const detailsForm = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Employee ID *</Label>
        <Input {...form.register('employeeId')} disabled={readOnly} />
        {form.formState.errors.employeeId && <p className="text-xs text-red-500">{form.formState.errors.employeeId.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Full Name *</Label>
        <Input {...form.register('fullName')} disabled={readOnly} />
        {form.formState.errors.fullName && <p className="text-xs text-red-500">{form.formState.errors.fullName.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Email *</Label>
        <Input type="email" {...form.register('email')} disabled={readOnly} />
        {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input {...form.register('mobileNumber')} disabled={readOnly} />
        {form.formState.errors.mobileNumber && <p className="text-xs text-red-500">{form.formState.errors.mobileNumber.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Department *</Label>
        <Select
          value={form.watch('department')}
          onValueChange={(v) => form.setValue('department', v)}
          disabled={readOnly}
        >
          <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
          <SelectContent>
            {masters.departments
              .filter((d) => d.status === 'Active' || !d.status)
              .map((d) => (
                <SelectItem key={d.id ?? d.departmentName} value={d.departmentName}>{d.departmentName}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        {!masters.departments.length && (
          <p className="text-xs text-muted-foreground">No departments found. Create departments in Admin first.</p>
        )}
        {form.formState.errors.department && <p className="text-xs text-red-500">{form.formState.errors.department.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Designation</Label>
        <Select
          value={form.watch('designation')}
          onValueChange={(v) => form.setValue('designation', v)}
          disabled={readOnly}
        >
          <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
          <SelectContent>
            {deptDesignations.map((d) => (
              <SelectItem key={d.id ?? `${d.department}-${d.designationName}`} value={d.designationName}>{d.designationName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Role *</Label>
        <Select value={form.watch('role')} onValueChange={(v) => form.setValue('role', v)} disabled={readOnly}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ADMIN_ROLES.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Reporting Manager</Label>
        <Input {...form.register('reportingManager')} disabled={readOnly} />
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={form.watch('userStatus')}
          onValueChange={(v) => form.setValue('userStatus', v as AdminUser['userStatus'])}
          disabled={readOnly}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {USER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Joining Date</Label>
        <Input type="date" {...form.register('joiningDate')} disabled={readOnly} />
      </div>
      {isCreate && !readOnly && (
        <div className="space-y-2 sm:col-span-2">
          <Label>Temporary Password *</Label>
          <Input
            type="password"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            placeholder="Min 8 characters"
          />
        </div>
      )}
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <Label>Account Locked</Label>
        <Switch
          checked={form.watch('accountLocked')}
          onCheckedChange={(v) => form.setValue('accountLocked', v)}
          disabled={readOnly}
        />
      </div>
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <Label>Password Reset Required</Label>
        <Switch
          checked={form.watch('passwordResetRequired')}
          onCheckedChange={(v) => form.setValue('passwordResetRequired', v)}
          disabled={readOnly}
        />
      </div>
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <Label>Two Factor Enabled</Label>
        <Switch
          checked={form.watch('twoFactorEnabled')}
          onCheckedChange={(v) => form.setValue('twoFactorEnabled', v)}
          disabled={readOnly}
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">User Details</TabsTrigger>
          <TabsTrigger value="access">Access Control</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4">
          {detailsForm}
        </TabsContent>
        <TabsContent value="access" className="mt-4">
          <UserAccessControl
            value={modulePermissions}
            onChange={setModulePermissions}
            presetId={presetId}
            onPresetChange={setPresetId}
            readOnly={readOnly}
          />
        </TabsContent>
      </Tabs>

      {!readOnly && (
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={submitting}>
            {submitting ? 'Saving...' : isCreate ? 'Create User' : 'Save Changes'}
          </Button>
        </div>
      )}
    </form>
  );
}
