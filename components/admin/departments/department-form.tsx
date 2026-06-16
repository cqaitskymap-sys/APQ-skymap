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
import { DEPARTMENT_TYPES, RECORD_STATUSES } from '@/lib/admin/constants';
import { departmentFormSchema, type DepartmentFormData } from '@/lib/admin/schemas';
import { fetchActiveUsers, fetchCompanySites } from '@/lib/admin/department-service';
import type { AdminUser } from '@/lib/admin/schemas';

interface DepartmentFormProps {
  initial?: Partial<DepartmentFormData>;
  readOnly?: boolean;
  onSubmit: (data: DepartmentFormData) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function DepartmentForm({
  initial,
  readOnly,
  onSubmit,
  onCancel,
  submitting,
}: DepartmentFormProps) {
  const [activeUsers, setActiveUsers] = useState<AdminUser[]>([]);
  const [sites, setSites] = useState<{ siteName: string }[]>([]);

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      departmentCode: '',
      departmentName: '',
      departmentType: 'QA',
      departmentHead: '',
      hodEmail: '',
      siteLocation: '',
      description: '',
      status: 'Active',
      ...initial,
    },
  });

  useEffect(() => {
    fetchActiveUsers().then(setActiveUsers);
    fetchCompanySites().then(setSites);
  }, []);

  useEffect(() => {
    if (initial) form.reset({ ...form.getValues(), ...initial });
  }, [initial, form]);

  const handleHeadChange = (userId: string) => {
    const user = activeUsers.find((u) => u.id === userId);
    if (user) {
      form.setValue('departmentHead', user.fullName);
      form.setValue('hodEmail', user.email);
    }
  };

  const selectedHeadId = activeUsers.find((u) => u.fullName === form.watch('departmentHead'))?.id || '';

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Department Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Department Code *</Label>
            <Input {...form.register('departmentCode')} disabled={readOnly} placeholder="e.g. QA" />
            {form.formState.errors.departmentCode && (
              <p className="text-xs text-red-500">{form.formState.errors.departmentCode.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Department Name *</Label>
            <Input {...form.register('departmentName')} disabled={readOnly} placeholder="e.g. Quality Assurance" />
            {form.formState.errors.departmentName && (
              <p className="text-xs text-red-500">{form.formState.errors.departmentName.message}</p>
            )}
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
            {form.formState.errors.departmentType && (
              <p className="text-xs text-red-500">{form.formState.errors.departmentType.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Site / Location</Label>
            <Select
              value={form.watch('siteLocation') || 'none'}
              onValueChange={(v) => form.setValue('siteLocation', v === 'none' ? '' : v)}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {sites.map((s) => <SelectItem key={s.siteName} value={s.siteName}>{s.siteName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Department Head *</Label>
            <Select
              value={selectedHeadId}
              onValueChange={handleHeadChange}
              disabled={readOnly}
            >
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
              <p className="text-xs text-red-500">{form.formState.errors.departmentHead.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>HOD Email</Label>
            <Input {...form.register('hodEmail')} disabled={readOnly} type="email" />
            {form.formState.errors.hodEmail && (
              <p className="text-xs text-red-500">{form.formState.errors.hodEmail.message}</p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Textarea {...form.register('description')} disabled={readOnly} rows={3} />
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
            {submitting ? 'Saving...' : 'Save Department'}
          </button>
        </div>
      )}
    </form>
  );
}
