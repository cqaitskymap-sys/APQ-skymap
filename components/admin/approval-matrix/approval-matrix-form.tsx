'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  APPROVAL_MATRIX_MODULES, RISK_LEVELS, ADMIN_ROLES, DEPARTMENT_TYPES,
} from '@/lib/admin/constants';
import { approvalMatrixFormSchema, type ApprovalMatrixFormData } from '@/lib/admin/schemas';
import { ApprovalFlowPreview } from './approval-flow-preview';
import type { ApprovalMatrix } from '@/lib/admin/schemas';

interface ApprovalMatrixFormProps {
  initial?: Partial<ApprovalMatrixFormData>;
  sites?: string[];
  products?: { code: string; name: string }[];
  readOnly?: boolean;
  roles?: { id: string; name: string }[];
  onSubmit: (data: ApprovalMatrixFormData) => void;
  onCancel: () => void;
  submitting?: boolean;
}

function rolesToOptions(roles?: { id: string; name: string }[]) {
  return roles || ADMIN_ROLES.map((r) => ({ id: r.id, name: r.name }));
}

export function ApprovalMatrixForm({
  initial, sites, products, readOnly, roles, onSubmit, onCancel, submitting,
}: ApprovalMatrixFormProps) {
  const form = useForm<ApprovalMatrixFormData>({
    resolver: zodResolver(approvalMatrixFormSchema),
    defaultValues: {
      matrixCode: '',
      matrixName: '',
      moduleName: 'PQR',
      department: 'QA',
      siteLocation: '',
      productOptional: '',
      processOptional: '',
      riskLevel: 'Medium',
      preparedByRole: 'qa_executive',
      reviewedByRole: '',
      verifiedByRole: '',
      approvedByRole: '',
      finalApproverRole: 'head_qa',
      escalationRole: 'head_qa',
      minimumApprovalLevel: 1,
      eSignatureRequired: true,
      approvalCommentRequired: true,
      parallelApprovalAllowed: false,
      sequentialApprovalRequired: true,
      delegationAllowed: false,
      remarks: '',
      ...initial,
    },
  });

  useEffect(() => {
    if (initial) form.reset({ ...form.getValues(), ...initial });
  }, [initial, form]);

  const roleOptions = rolesToOptions(roles);
  const watchAll = form.watch();

  const previewMatrix = {
    ...watchAll,
    module: watchAll.moduleName,
    moduleName: watchAll.moduleName,
    status: 'Active' as const,
    preparedByRole: watchAll.preparedByRole,
    reviewedByRole: watchAll.reviewedByRole,
    verifiedByRole: watchAll.verifiedByRole,
    approvedByRole: watchAll.approvedByRole,
    finalApproverRole: watchAll.finalApproverRole,
    eSignatureRequired: watchAll.eSignatureRequired,
    approvalCommentRequired: watchAll.approvalCommentRequired,
  } as ApprovalMatrix;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Matrix Identity</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Matrix Code *</Label>
            <Input {...form.register('matrixCode')} disabled={readOnly || !!initial?.matrixCode} />
            {form.formState.errors.matrixCode && <p className="text-xs text-red-500">{form.formState.errors.matrixCode.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Matrix Name *</Label>
            <Input {...form.register('matrixName')} disabled={readOnly} />
            {form.formState.errors.matrixName && <p className="text-xs text-red-500">{form.formState.errors.matrixName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Module Name *</Label>
            <Select
              value={form.watch('moduleName')}
              onValueChange={(v) => form.setValue('moduleName', v as ApprovalMatrixFormData['moduleName'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPROVAL_MATRIX_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Department *</Label>
            <Select value={form.watch('department')} onValueChange={(v) => form.setValue('department', v)} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTMENT_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.formState.errors.department && <p className="text-xs text-red-500">{form.formState.errors.department.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Site / Location</Label>
            <Select
              value={form.watch('siteLocation') || '__all__'}
              onValueChange={(v) => form.setValue('siteLocation', v === '__all__' ? '' : v)}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="All sites" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Sites</SelectItem>
                {(sites || []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Risk Level</Label>
            <Select
              value={form.watch('riskLevel')}
              onValueChange={(v) => form.setValue('riskLevel', v as ApprovalMatrixFormData['riskLevel'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Product (Optional)</Label>
            <Select
              value={form.watch('productOptional') || '__none__'}
              onValueChange={(v) => form.setValue('productOptional', v === '__none__' ? '' : v)}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="All products" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">All Products</SelectItem>
                {(products || []).map((p) => <SelectItem key={p.code} value={p.code}>{p.code} — {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Process (Optional)</Label>
            <Input {...form.register('processOptional')} disabled={readOnly} placeholder="e.g. Sterile Filling" />
          </div>
          <div className="space-y-2">
            <Label>Minimum Approval Level</Label>
            <Input type="number" min={1} {...form.register('minimumApprovalLevel', { valueAsNumber: true })} disabled={readOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Approval Authority (comma-separated for multiple roles)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'preparedByRole', label: 'Level 1 — Prepared By' },
            { key: 'reviewedByRole', label: 'Level 2 — Reviewed By' },
            { key: 'verifiedByRole', label: 'Level 3 — Verified By' },
            { key: 'approvedByRole', label: 'Level 4 — Approved By' },
            { key: 'finalApproverRole', label: 'Level 5 — Final Approver *' },
            { key: 'escalationRole', label: 'Escalation Role' },
          ].map((field) => (
            <div key={field.key} className="space-y-2">
              <Label>{field.label}</Label>
              <Select
                value={form.watch(field.key as keyof ApprovalMatrixFormData) as string || '__none__'}
                onValueChange={(v) => {
                  if (field.key === 'reviewedByRole') {
                    form.setValue('reviewedByRole', v === '__none__' ? '' : v);
                  } else {
                    form.setValue(field.key as keyof ApprovalMatrixFormData, (v === '__none__' ? '' : v) as never);
                  }
                }}
                disabled={readOnly}
              >
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {roleOptions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {field.key === 'reviewedByRole' && (
                <Input
                  placeholder="Or comma-separated: qa_manager,qc_manager"
                  value={form.watch('reviewedByRole')}
                  disabled={readOnly}
                  onChange={(e) => form.setValue('reviewedByRole', e.target.value)}
                  className="text-xs"
                />
              )}
            </div>
          ))}
          {form.formState.errors.finalApproverRole && (
            <p className="text-xs text-red-500 sm:col-span-2">{form.formState.errors.finalApproverRole.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Approval Options</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { key: 'eSignatureRequired', label: 'E-Signature Required' },
            { key: 'approvalCommentRequired', label: 'Approval Comment Required' },
            { key: 'parallelApprovalAllowed', label: 'Parallel Approval' },
            { key: 'sequentialApprovalRequired', label: 'Sequential Approval' },
            { key: 'delegationAllowed', label: 'Delegation Allowed' },
          ].map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <Checkbox
                checked={form.watch(item.key as keyof ApprovalMatrixFormData) as boolean}
                onCheckedChange={(v) => form.setValue(item.key as keyof ApprovalMatrixFormData, Boolean(v) as never)}
                disabled={readOnly}
              />
              <Label className="text-sm">{item.label}</Label>
            </div>
          ))}
          <div className="space-y-2 sm:col-span-2">
            <Label>Remarks</Label>
            <Textarea {...form.register('remarks')} disabled={readOnly} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Approval Flow Preview</CardTitle></CardHeader>
        <CardContent>
          <ApprovalFlowPreview matrix={previewMatrix} />
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Matrix'}
          </Button>
        </div>
      )}
    </form>
  );
}
