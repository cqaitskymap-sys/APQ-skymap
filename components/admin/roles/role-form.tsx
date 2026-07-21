'use client';

import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ROLE_PRESET_OPTIONS, RECORD_STATUSES, DATA_SCOPE_OPTIONS, FIELD_ACCESS_LEVELS,
  ADMIN_COLLECTIONS,
} from '@/lib/admin/constants';
import { roleFormSchema, type RoleFormData } from '@/lib/admin/schemas';
import { buildDefaultRoleMatrix } from '@/lib/permissions';
import { fetchRoles, fetchRolePermissions } from '@/lib/admin/role-service';
import { getAdminRecords } from '@/lib/admin/admin-service';
import { PermissionMatrix } from './permission-matrix';

interface RoleFormProps {
  initial?: Partial<RoleFormData>;
  readOnly?: boolean;
  isSuperAdminRole?: boolean;
  onSubmit: (data: RoleFormData) => void;
  onCancel: () => void;
  submitting?: boolean;
}

function emptyMatrix() {
  return {} as Record<string, Record<string, boolean>>;
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
  const [sites, setSites] = useState<{ id: string; siteName: string; companyName?: string }[]>([]);
  const [copying, setCopying] = useState(false);

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      roleId: '',
      roleName: '',
      roleDescription: '',
      roleLevel: 10,
      departmentAccess: '',
      siteAccess: '',
      businessUnitAccess: '',
      dataScope: 'Organization Records',
      fieldPolicies: [],
      status: 'Active',
      permissions: buildDefaultRoleMatrix('qa'),
      changeReason: '',
      ...initial,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'fieldPolicies',
  });

  const permissions = form.watch('permissions');

  useEffect(() => {
    fetchRoles()
      .then((r) => setAllRoles(r.map((x) => ({ roleId: x.roleId, roleName: x.roleName }))))
      .catch(() => setAllRoles([]));
    getAdminRecords<{ departmentName: string }>(ADMIN_COLLECTIONS.departments)
      .then((d) =>
        setDepartments(
          Array.from(new Set(d.map((x) => x.departmentName.trim()).filter(Boolean))).sort((a, b) =>
            a.localeCompare(b),
          ),
        ),
      )
      .catch(() => setDepartments(['QA', 'QC', 'Production']));
    getAdminRecords<{ id?: string; siteName: string; companyName?: string }>(ADMIN_COLLECTIONS.companySites)
      .then((rows) => setSites(rows.map((s) => ({ id: s.id || s.siteName, siteName: s.siteName, companyName: s.companyName }))))
      .catch(() => setSites([]));
  }, []);

  useEffect(() => {
    if (initial) form.reset({ ...form.getValues(), ...initial, changeReason: initial.changeReason || '' });
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
    setCopying(true);
    try {
      const match = await fetchRolePermissions(copyFromRoleId);
      if (match?.permissions) {
        form.setValue('permissions', { ...match.permissions });
      }
    } finally {
      setCopying(false);
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
                <SelectTrigger><SelectValue placeholder="Select system preset (optional)" /></SelectTrigger>
                <SelectContent>
                  {ROLE_PRESET_OPTIONS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="roleId">Role ID *</Label>
            <Input id="roleId" {...form.register('roleId')} disabled={readOnly || !!initial?.roleId} />
            {form.formState.errors.roleId && <p className="text-xs text-destructive">{form.formState.errors.roleId.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="roleName">Role Name *</Label>
            <Input id="roleName" {...form.register('roleName')} disabled={readOnly} />
            {form.formState.errors.roleName && <p className="text-xs text-destructive">{form.formState.errors.roleName.message}</p>}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="roleDescription">Role Description</Label>
            <Textarea id="roleDescription" {...form.register('roleDescription')} disabled={readOnly} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roleLevel">Role Level</Label>
            <Input id="roleLevel" type="number" {...form.register('roleLevel', { valueAsNumber: true })} disabled={readOnly || isSuperAdminRole} />
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
        <CardHeader><CardTitle className="text-base">Row-Level Access Scope</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data Scope</Label>
            <Select
              value={form.watch('dataScope')}
              onValueChange={(v) => form.setValue('dataScope', v as RoleFormData['dataScope'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATA_SCOPE_OPTIONS.map((scope) => (
                  <SelectItem key={scope} value={scope}>{scope}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label>Site Access</Label>
            <Select
              value={form.watch('siteAccess') || 'all'}
              onValueChange={(v) => {
                form.setValue('siteAccess', v === 'all' ? '' : v);
                const site = sites.find((s) => s.siteName === v);
                if (site?.companyName) form.setValue('businessUnitAccess', site.companyName);
                if (v === 'all') form.setValue('businessUnitAccess', '');
              }}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="All sites" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites.map((s) => <SelectItem key={s.id} value={s.siteName}>{s.siteName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessUnitAccess">Business Unit Access</Label>
            <Input id="businessUnitAccess" {...form.register('businessUnitAccess')} disabled={readOnly} placeholder="All business units" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Field-Level Security</CardTitle>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ fieldKey: '', access: 'Read Only', modules: [], condition: '' })}
            >
              <Plus className="h-4 w-4 mr-1" />Add Field Rule
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No field policies. Fields inherit module edit rights unless restricted.</p>
          ) : (
            fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-lg border p-3">
                <div className="space-y-1">
                  <Label>Field Key</Label>
                  <Input {...form.register(`fieldPolicies.${index}.fieldKey`)} disabled={readOnly} placeholder="e.g. batchYield" />
                </div>
                <div className="space-y-1">
                  <Label>Access</Label>
                  <Select
                    value={form.watch(`fieldPolicies.${index}.access`)}
                    onValueChange={(v) => form.setValue(`fieldPolicies.${index}.access`, v as RoleFormData['fieldPolicies'][number]['access'])}
                    disabled={readOnly}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_ACCESS_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>{level}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Condition / Notes</Label>
                  <div className="flex gap-2">
                    <Input {...form.register(`fieldPolicies.${index}.condition`)} disabled={readOnly} placeholder="Role / department / site condition" />
                    {!readOnly && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove field rule">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
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
              <Button type="button" variant="outline" size="sm" onClick={copyPermissions} disabled={!copyFromRoleId || copying}>
                {copying ? 'Copying…' : 'Apply'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <PermissionMatrix
            permissions={permissions || emptyMatrix()}
            onChange={(p) => form.setValue('permissions', p, { shouldValidate: true })}
            disabled={isSuperAdminRole}
            readOnly={readOnly}
          />
          {form.formState.errors.permissions && (
            <p className="text-xs text-destructive mt-2">{String(form.formState.errors.permissions.message)}</p>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <Card>
          <CardHeader><CardTitle className="text-base">Change Control</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="changeReason">Change Reason * (ALCOA+ / Part 11)</Label>
            <Textarea
              id="changeReason"
              {...form.register('changeReason')}
              rows={2}
              placeholder="Document why this role or permission change is required"
            />
            {form.formState.errors.changeReason && (
              <p className="text-xs text-destructive">{form.formState.errors.changeReason.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {!readOnly && (
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
            {submitting ? 'Saving…' : 'Save Role'}
          </Button>
        </div>
      )}
    </form>
  );
}
