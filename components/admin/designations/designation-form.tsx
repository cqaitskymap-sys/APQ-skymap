'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DESIGNATION_LEVELS, DESIGNATION_PRESETS, RECORD_STATUSES } from '@/lib/admin/constants';
import { designationFormSchema, type DesignationFormData } from '@/lib/admin/schemas';
import { fetchActiveDepartmentsForDesignation } from '@/lib/admin/designation-service';

interface DesignationFormProps {
  initial?: Partial<DesignationFormData>;
  readOnly?: boolean;
  onSubmit: (data: DesignationFormData) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function DesignationForm({
  initial,
  readOnly,
  onSubmit,
  onCancel,
  submitting,
}: DesignationFormProps) {
  const form = useForm<DesignationFormData>({
    resolver: zodResolver(designationFormSchema),
    defaultValues: {
      designationCode: '',
      designationName: '',
      department: '',
      designationLevel: 'Executive',
      approvalAuthority: false,
      canReview: false,
      canApprove: false,
      canESign: false,
      description: '',
      status: 'Active',
      ...initial,
    },
  });

  const [departments, setDepartments] = useState<{ departmentName: string }[]>([]);

  useEffect(() => {
    fetchActiveDepartmentsForDesignation().then(setDepartments);
  }, []);

  useEffect(() => {
    if (initial) form.reset({ ...form.getValues(), ...initial });
  }, [initial, form]);

  const handlePreset = (presetCode: string) => {
    const preset = DESIGNATION_PRESETS.find((p) => p.code === presetCode);
    if (!preset) return;
    form.setValue('designationCode', preset.code);
    form.setValue('designationName', preset.name);
    form.setValue('department', preset.department);
    form.setValue('designationLevel', preset.level as DesignationFormData['designationLevel']);
    if (preset.level === 'Manager' || preset.level === 'Head') {
      form.setValue('approvalAuthority', true);
      form.setValue('canApprove', true);
      form.setValue('canReview', true);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Designation Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!initial?.designationCode && (
            <div className="space-y-2 sm:col-span-2">
              <Label>Preset Designation</Label>
              <Select onValueChange={handlePreset}>
                <SelectTrigger><SelectValue placeholder="Select preset (optional)" /></SelectTrigger>
                <SelectContent>
                  {DESIGNATION_PRESETS.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Designation Code *</Label>
            <Input {...form.register('designationCode')} disabled={readOnly} />
            {form.formState.errors.designationCode && (
              <p className="text-xs text-red-500">{form.formState.errors.designationCode.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Designation Name *</Label>
            <Input {...form.register('designationName')} disabled={readOnly} />
            {form.formState.errors.designationName && (
              <p className="text-xs text-red-500">{form.formState.errors.designationName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Department *</Label>
            <Select
              value={form.watch('department')}
              onValueChange={(v) => form.setValue('department', v)}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="Select active department" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.departmentCode} value={d.departmentName}>{d.departmentName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.department && (
              <p className="text-xs text-red-500">{form.formState.errors.department.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Designation Level *</Label>
            <Select
              value={form.watch('designationLevel')}
              onValueChange={(v) => form.setValue('designationLevel', v as DesignationFormData['designationLevel'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DESIGNATION_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.formState.errors.designationLevel && (
              <p className="text-xs text-red-500">{form.formState.errors.designationLevel.message}</p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Textarea {...form.register('description')} disabled={readOnly} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.watch('status')}
              onValueChange={(v) => form.setValue('status', v as DesignationFormData['status'])}
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

      <Card>
        <CardHeader><CardTitle className="text-base">Approval & Authority</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'approvalAuthority', label: 'Approval Authority' },
            { key: 'canReview', label: 'Can Review' },
            { key: 'canApprove', label: 'Can Approve' },
            { key: 'canESign', label: 'Can E-Sign' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
              <Label>{label}</Label>
              <Switch
                checked={form.watch(key as keyof DesignationFormData) as boolean}
                onCheckedChange={(v) => form.setValue(key as keyof DesignationFormData, v as never)}
                disabled={readOnly}
              />
            </div>
          ))}
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
            {submitting ? 'Saving...' : 'Save Designation'}
          </button>
        </div>
      )}
    </form>
  );
}