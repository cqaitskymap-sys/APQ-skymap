'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLE_PRESET_OPTIONS, RECORD_STATUSES } from '@/lib/admin/constants';
import { roleFormSchema, type RoleFormData } from '@/lib/admin/schemas';
import { buildDefaultRoleMatrix } from '@/lib/permissions';
import { fetchRoles } from '@/lib/admin/role-service';
import { PermissionMatrix } from './permission-matrix';
import { getAdminRecords } from '@/lib/admin/admin-service';
import { ADMIN_COLLECTIONS } from '@/lib/admin/constants';

interface RoleFormProps {
  initial?: Partial<RoleFormData>;
  readOnly?: boolean;
  isSuperAdminRole?: boolean;
  onSubmit: (data: RoleFormData) => void;
  onCancel: () => void;
  submitting?: boolean;
}

function emptyMatrix() {
  const matrix: Record<string, Record<string, boolean>> = {};
  return matrix;
}

export function RoleForm({
  initial,
  readOnly,
  isSuperAdminRole,
  onSubmit,
  onCancel,
  submitting,
}: RoleFormProps) {
  const [copyFromRoleId, setCopyFromRoleId] = useState('');
  const [allRoles, setAllRoles] = useState<{ roleId: string; roleName: string }[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      roleId: '',
      roleName: '',
      roleDescription: '',
      roleLevel: 10,
      departmentAccess: '',
      status: 'Active',
      permissions: buildDefaultRoleMatrix('qa'),
      ...initial,
    },
  });

  const permissions = form.watch('permissions');

  useEffect(() => {
    fetchRoles().then((r) => setAllRoles(r.map((x) => ({ roleId: x.roleId, roleName: x.roleName }))));
    getAdminRecords<{ departmentName: string }>(ADMIN_COLLECTIONS.departments)
      .then((d) => setDepartments(d.map((x) => x.departmentName)))
      .catch(() => setDepartments(['QA', 'QC', 'Production']));
  }, []);

  useEffect(() => {
    if (initial) form.reset({ ...form.getValues(), ...initial });
  }, [initial, form]);

  const handlePresetChange = (presetId: string) => {
    const preset = ROLE_PRESET_OPTIONS.find((p) => p.id === presetId);
    if (!preset) return;
    form.setValue('roleId', preset.id);
    form.setValue('roleName', preset.name);
    form.setValue('roleLevel', preset.level);
    if (!initial?.permissions) {
      form.setValue('permissions', buildDefaultRoleMatrix(preset.id));
    }
  };

  const copyPermissions = async () => {
    if (!copyFromRoleId) return;
    const perms = await getAdminRecords<{ roleId: string; permissions: Record<string, Record<string, boolean>> }>(
      ADMIN_COLLECTIONS.permissions,
    );
    const match = perms.find((p) => p.roleId === copyFromRoleId);
    if (match?.permissions) {
      form.setValue('permissions', { ...match.permissions });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Role Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!initial?.roleId && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Preset Role Type</Label>
              <Select onValueChange={handlePresetChange}>
                <SelectTrigger><SelectValue placeholder="Select preset (optional)" /></SelectTrigger>
                <SelectContent>
                  {ROLE_PRESET_OPTIONS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Role ID *</Label>
            <Input {...form.register('roleId')} disabled={readOnly || !!initial?.roleId} />
            {form.formState.errors.roleId && <p className="text-xs text-red-500">{form.formState.errors.roleId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Role Name *</Label>
            <Input {...form.register('roleName')} disabled={readOnly} />
            {form.formState.errors.roleName && <p className="text-xs text-red-500">{form.formState.errors.roleName.message}</p>}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Role Description</Label>
            <Textarea {...form.register('roleDescription')} disabled={readOnly} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Role Level</Label>
            <Input type="number" {...form.register('roleLevel', { valueAsNumber: true })} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label>Department Access</Label>
            <Select
              value={form.watch('departmentAccess') || 'all'}
              onValueChange={(v) => form.setValue('departmentAccess', v === 'all' ? '' : v)}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.watch('status')}
              onValueChange={(v) => form.setValue('status', v as RoleFormData['status'])}
              disabled={readOnly || isSuperAdminRole}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Permission Matrix</CardTitle>
          {!readOnly && !isSuperAdminRole && (
            <div className="flex items-center gap-2">
              <Select value={copyFromRoleId} onValueChange={setCopyFromRoleId}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue placeholder="Copy from role" /></SelectTrigger>
                <SelectContent>
                  {allRoles.map((r) => (
                    <SelectItem key={r.roleId} value={r.roleId}>{r.roleName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button type="button" className="text-sm text-blue-600 hover:underline" onClick={copyPermissions}>
                Apply
              </button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <PermissionMatrix
            permissions={permissions || emptyMatrix()}
            onChange={(p) => form.setValue('permissions', p)}
            disabled={isSuperAdminRole}
            readOnly={readOnly}
          />
          {form.formState.errors.permissions && (
            <p className="text-xs text-red-500 mt-2">{String(form.formState.errors.permissions.message)}</p>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex justify-end gap-3">
          <button type="button" className="px-4 py-2 border rounded-md text-sm" onClick={onCancel}>Cancel</button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Role'}
          </button>
        </div>
      )}
    </form>
  );
}
