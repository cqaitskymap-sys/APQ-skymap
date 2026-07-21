'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DESIGNATION_LEVELS, DESIGNATION_PRESETS, RECORD_STATUSES,
  EMPLOYMENT_CATEGORIES, JOB_BANDS, JOB_GRADES, REPORTING_LEVELS,
} from '@/lib/admin/constants';
import {
  designationFormSchema, type Designation, type DesignationFormData,
} from '@/lib/admin/schemas';
import {
  fetchActiveDepartmentsForDesignation, fetchDesignations,
} from '@/lib/admin/designation-service';
import { fetchCompanySites } from '@/lib/admin/department-service';

interface DesignationFormProps {
  initial?: Partial<DesignationFormData>;
  currentId?: string;
  readOnly?: boolean;
  onSubmit: (data: DesignationFormData) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function DesignationForm({
  initial,
  currentId,
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
      shortName: '',
      department: '',
      parentDesignationId: '',
      designationLevel: 'Executive',
      reportingLevel: '',
      jobGrade: '',
      jobBand: '',
      jobLevel: '',
      employmentCategory: 'Permanent',
      minimumExperience: 0,
      requiredQualification: '',
      requiredSkills: '',
      businessUnit: '',
      siteId: '',
      siteName: '',
      approvalAuthority: false,
      canReview: false,
      canApprove: false,
      canESign: false,
      description: '',
      remarks: '',
      status: 'Active',
      changeReason: '',
      ...initial,
    },
  });

  const [departments, setDepartments] = useState<{ departmentName: string; departmentCode: string }[]>([]);
  const [parents, setParents] = useState<Designation[]>([]);
  const [sites, setSites] = useState<{ id?: string; siteName: string; companyName?: string }[]>([]);

  useEffect(() => {
    fetchActiveDepartmentsForDesignation().then(setDepartments).catch(() => setDepartments([]));
    fetchDesignations()
      .then((rows) => setParents(rows.filter((d) => d.id !== currentId && d.status === 'Active')))
      .catch(() => setParents([]));
    fetchCompanySites().then(setSites).catch(() => setSites([]));
  }, [currentId]);

  useEffect(() => {
    if (initial) form.reset({ ...form.getValues(), ...initial, changeReason: initial.changeReason || '' });
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
            <Label htmlFor="designationCode">Designation Code *</Label>
            <Input id="designationCode" {...form.register('designationCode')} disabled={readOnly} />
            {form.formState.errors.designationCode && (
              <p className="text-xs text-destructive">{form.formState.errors.designationCode.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="designationName">Designation Name *</Label>
            <Input id="designationName" {...form.register('designationName')} disabled={readOnly} />
            {form.formState.errors.designationName && (
              <p className="text-xs text-destructive">{form.formState.errors.designationName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="shortName">Short Name</Label>
            <Input id="shortName" {...form.register('shortName')} disabled={readOnly} />
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
              <p className="text-xs text-destructive">{form.formState.errors.department.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Parent Designation</Label>
            <Select
              value={form.watch('parentDesignationId') || 'none'}
              onValueChange={(v) => form.setValue('parentDesignationId', v === 'none' ? '' : v)}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="No parent (top-level)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No parent (top-level)</SelectItem>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id!}>{p.designationName} ({p.designationCode})</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} disabled={readOnly} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Grade, Band & Reporting</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Reporting Level</Label>
            <Select
              value={form.watch('reportingLevel') || 'none'}
              onValueChange={(v) => form.setValue('reportingLevel', v === 'none' ? '' : v as DesignationFormData['reportingLevel'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {REPORTING_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Job Grade</Label>
            <Select
              value={form.watch('jobGrade') || 'none'}
              onValueChange={(v) => form.setValue('jobGrade', v === 'none' ? '' : v as DesignationFormData['jobGrade'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {JOB_GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Job Band</Label>
            <Select
              value={form.watch('jobBand') || 'none'}
              onValueChange={(v) => form.setValue('jobBand', v === 'none' ? '' : v as DesignationFormData['jobBand'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {JOB_BANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobLevel">Job Level</Label>
            <Input id="jobLevel" {...form.register('jobLevel')} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label>Employment Category</Label>
            <Select
              value={form.watch('employmentCategory')}
              onValueChange={(v) => form.setValue('employmentCategory', v as DesignationFormData['employmentCategory'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minimumExperience">Minimum Experience (years)</Label>
            <Input id="minimumExperience" type="number" {...form.register('minimumExperience', { valueAsNumber: true })} disabled={readOnly} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="requiredQualification">Required Qualification</Label>
            <Input id="requiredQualification" {...form.register('requiredQualification')} disabled={readOnly} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="requiredSkills">Required Skills</Label>
            <Textarea id="requiredSkills" {...form.register('requiredSkills')} disabled={readOnly} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Site & Business Unit</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Site</Label>
            <Select
              value={form.watch('siteId') || form.watch('siteName') || 'none'}
              onValueChange={(v) => {
                if (v === 'none') {
                  form.setValue('siteId', '');
                  form.setValue('siteName', '');
                  return;
                }
                const site = sites.find((s) => s.id === v || s.siteName === v);
                form.setValue('siteId', site?.id || '');
                form.setValue('siteName', site?.siteName || v);
                if (site?.companyName) form.setValue('businessUnit', site.companyName);
              }}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="Optional site" /></SelectTrigger>
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
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" {...form.register('remarks')} disabled={readOnly} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Approval & Authority</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'approvalAuthority' as const, label: 'Approval Authority' },
            { key: 'canReview' as const, label: 'Can Review' },
            { key: 'canApprove' as const, label: 'Can Approve' },
            { key: 'canESign' as const, label: 'Can E-Sign' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
              <Label>{label}</Label>
              <Switch
                checked={Boolean(form.watch(key))}
                onCheckedChange={(v) => form.setValue(key, v)}
                disabled={readOnly}
              />
            </div>
          ))}
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
              placeholder="Document why this designation change is required"
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
            {submitting ? 'Saving…' : 'Save Designation'}
          </Button>
        </div>
      )}
    </form>
  );
}
