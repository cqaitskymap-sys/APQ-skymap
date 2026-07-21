'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEPARTMENT_TYPES, RECORD_STATUSES } from '@/lib/admin/constants';
import { departmentFormSchema, type Department, type DepartmentFormData, type AdminUser } from '@/lib/admin/schemas';
import {
  fetchActiveUsers, fetchCompanySites, fetchDepartments,
} from '@/lib/admin/department-service';

interface DepartmentFormProps {
  initial?: Partial<DepartmentFormData>;
  currentId?: string;
  readOnly?: boolean;
  onSubmit: (data: DepartmentFormData) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function DepartmentForm({
  initial,
  currentId,
  readOnly,
  onSubmit,
  onCancel,
  submitting,
}: DepartmentFormProps) {
  const [activeUsers, setActiveUsers] = useState<AdminUser[]>([]);
  const [sites, setSites] = useState<{ id?: string; siteName: string; companyName?: string }[]>([]);
  const [parents, setParents] = useState<Department[]>([]);

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      departmentCode: '',
      departmentName: '',
      shortName: '',
      departmentType: 'QA',
      parentDepartmentId: '',
      departmentHead: '',
      departmentHeadId: '',
      manager: '',
      managerId: '',
      hodEmail: '',
      email: '',
      phone: '',
      extension: '',
      businessUnit: '',
      siteId: '',
      siteLocation: '',
      location: '',
      costCenter: '',
      description: '',
      remarks: '',
      status: 'Active',
      changeReason: '',
      ...initial,
    },
  });

  useEffect(() => {
    fetchActiveUsers().then(setActiveUsers).catch(() => setActiveUsers([]));
    fetchCompanySites().then(setSites).catch(() => setSites([]));
    fetchDepartments()
      .then((rows) => setParents(rows.filter((d) => d.id !== currentId && d.status === 'Active')))
      .catch(() => setParents([]));
  }, [currentId]);

  useEffect(() => {
    if (initial) form.reset({ ...form.getValues(), ...initial, changeReason: initial.changeReason || '' });
  }, [initial, form]);

  const handleHeadChange = (userId: string) => {
    const user = activeUsers.find((u) => u.id === userId);
    if (!user) return;
    form.setValue('departmentHeadId', user.id || '');
    form.setValue('departmentHead', user.fullName);
    form.setValue('hodEmail', user.email);
    if (!form.getValues('email')) form.setValue('email', user.email);
  };

  const handleManagerChange = (userId: string) => {
    if (userId === 'none') {
      form.setValue('managerId', '');
      form.setValue('manager', '');
      return;
    }
    const user = activeUsers.find((u) => u.id === userId);
    if (!user) return;
    form.setValue('managerId', user.id || '');
    form.setValue('manager', user.fullName);
  };

  const selectedHeadId = form.watch('departmentHeadId')
    || activeUsers.find((u) => u.fullName === form.watch('departmentHead'))?.id
    || '';
  const selectedManagerId = form.watch('managerId')
    || activeUsers.find((u) => u.fullName === form.watch('manager'))?.id
    || 'none';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Department Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="departmentCode">Department Code *</Label>
            <Input id="departmentCode" {...form.register('departmentCode')} disabled={readOnly} placeholder="e.g. QA" />
            {form.formState.errors.departmentCode && (
              <p className="text-xs text-destructive">{form.formState.errors.departmentCode.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="departmentName">Department Name *</Label>
            <Input id="departmentName" {...form.register('departmentName')} disabled={readOnly} placeholder="e.g. Quality Assurance" />
            {form.formState.errors.departmentName && (
              <p className="text-xs text-destructive">{form.formState.errors.departmentName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="shortName">Short Name</Label>
            <Input id="shortName" {...form.register('shortName')} disabled={readOnly} placeholder="Optional short label" />
          </div>
          <div className="space-y-2">
            <Label>Department Type *</Label>
            <Select
              value={form.watch('departmentType')}
              onValueChange={(v) => form.setValue('departmentType', v as DepartmentFormData['departmentType'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {DEPARTMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Parent Department</Label>
            <Select
              value={form.watch('parentDepartmentId') || 'none'}
              onValueChange={(v) => form.setValue('parentDepartmentId', v === 'none' ? '' : v)}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="No parent (top-level)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No parent (top-level)</SelectItem>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id!}>{p.departmentName} ({p.departmentCode})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.watch('status')}
              onValueChange={(v) => form.setValue('status', v as DepartmentFormData['status'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECORD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} disabled={readOnly} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Leadership & Contact</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Department Head *</Label>
            <Select value={selectedHeadId} onValueChange={handleHeadChange} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Select active user" /></SelectTrigger>
              <SelectContent>
                {activeUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id || u.userId || u.employeeId}>
                    {u.fullName} ({u.employeeId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.departmentHead && (
              <p className="text-xs text-destructive">{form.formState.errors.departmentHead.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Manager</Label>
            <Select value={selectedManagerId || 'none'} onValueChange={handleManagerChange} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Optional manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not assigned</SelectItem>
                {activeUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id || u.userId || u.employeeId}>
                    {u.fullName} ({u.employeeId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hodEmail">HOD Email</Label>
            <Input id="hodEmail" type="email" {...form.register('hodEmail')} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Department Email</Label>
            <Input id="email" type="email" {...form.register('email')} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...form.register('phone')} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="extension">Extension</Label>
            <Input id="extension" {...form.register('extension')} disabled={readOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Site, Cost Center & Location</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Site</Label>
            <Select
              value={form.watch('siteId') || form.watch('siteLocation') || 'none'}
              onValueChange={(v) => {
                if (v === 'none') {
                  form.setValue('siteId', '');
                  form.setValue('siteLocation', '');
                  return;
                }
                const site = sites.find((s) => s.id === v || s.siteName === v);
                form.setValue('siteId', site?.id || '');
                form.setValue('siteLocation', site?.siteName || v);
                if (site?.companyName) form.setValue('businessUnit', site.companyName);
                if (!form.getValues('location')) form.setValue('location', site?.siteName || v);
              }}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {sites.map((s) => (
                  <SelectItem key={s.id || s.siteName} value={s.id || s.siteName}>{s.siteName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessUnit">Business Unit</Label>
            <Input id="businessUnit" {...form.register('businessUnit')} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" {...form.register('location')} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="costCenter">Cost Center</Label>
            <Input id="costCenter" {...form.register('costCenter')} disabled={readOnly} placeholder="e.g. CC-QA-01" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" {...form.register('remarks')} disabled={readOnly} rows={2} />
          </div>
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
              placeholder="Document why this department change is required"
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
            {submitting ? 'Saving…' : 'Save Department'}
          </Button>
        </div>
      )}
    </form>
  );
}
