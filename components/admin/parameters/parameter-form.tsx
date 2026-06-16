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
  PARAMETER_TYPES, PARAMETER_CATEGORIES, PROCESS_STAGES,
  RESULT_TYPES, CRITICALITY_OPTIONS, FREQUENCY_OPTIONS,
} from '@/lib/admin/constants';
import { parameterFormSchema, type ParameterFormData, type AdminProduct } from '@/lib/admin/schemas';

interface ParameterFormProps {
  initial?: Partial<ParameterFormData>;
  products: AdminProduct[];
  readOnly?: boolean;
  onSubmit: (data: ParameterFormData) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function ParameterForm({
  initial, products, readOnly, onSubmit, onCancel, submitting,
}: ParameterFormProps) {
  const form = useForm<ParameterFormData>({
    resolver: zodResolver(parameterFormSchema),
    defaultValues: {
      parameterCode: '',
      parameterName: '',
      parameterType: 'CPP',
      parameterCategory: 'Manufacturing',
      productLink: '',
      processStage: 'Mixing',
      department: '',
      testMethodStp: '',
      specificationNo: '',
      targetValue: '',
      lowerLimit: '',
      upperLimit: '',
      alertLimitLow: '',
      alertLimitHigh: '',
      actionLimitLow: '',
      actionLimitHigh: '',
      unit: '',
      resultType: 'Numeric',
      frequency: 'Per Batch',
      criticality: 'Major',
      ootApplicable: false,
      oosApplicable: false,
      autoDeviationRequired: false,
      autoCapaRequired: false,
      remarks: '',
      ...initial,
    },
  });

  useEffect(() => {
    if (initial) form.reset({ ...form.getValues(), ...initial });
  }, [initial, form]);

  const resultType = form.watch('resultType');
  const isNumeric = resultType === 'Numeric';
  const activeProducts = products.filter((p) => p.productStatus === 'Active');

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Parameter Identity</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Parameter Code *</Label>
            <Input {...form.register('parameterCode')} disabled={readOnly || !!initial?.parameterCode} />
            {form.formState.errors.parameterCode && <p className="text-xs text-red-500">{form.formState.errors.parameterCode.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Parameter Name *</Label>
            <Input {...form.register('parameterName')} disabled={readOnly} />
            {form.formState.errors.parameterName && <p className="text-xs text-red-500">{form.formState.errors.parameterName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Parameter Type *</Label>
            <Select
              value={form.watch('parameterType')}
              onValueChange={(v) => form.setValue('parameterType', v as ParameterFormData['parameterType'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARAMETER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Parameter Category</Label>
            <Select
              value={form.watch('parameterCategory')}
              onValueChange={(v) => form.setValue('parameterCategory', v as ParameterFormData['parameterCategory'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARAMETER_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Product Link</Label>
            <Select
              value={form.watch('productLink') || '__none__'}
              onValueChange={(v) => form.setValue('productLink', v === '__none__' ? '' : v)}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue placeholder="All products" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">All Products</SelectItem>
                {activeProducts.map((p) => (
                  <SelectItem key={p.productCode} value={p.productCode}>{p.productCode} — {p.productName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Process Stage</Label>
            <Select
              value={form.watch('processStage')}
              onValueChange={(v) => form.setValue('processStage', v as ParameterFormData['processStage'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROCESS_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Input {...form.register('department')} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label>Test Method / STP No</Label>
            <Input {...form.register('testMethodStp')} disabled={readOnly} />
          </div>
          <div className="space-y-2">
            <Label>Specification No</Label>
            <Input {...form.register('specificationNo')} disabled={readOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Limits & Results</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Result Type *</Label>
            <Select
              value={form.watch('resultType')}
              onValueChange={(v) => form.setValue('resultType', v as ParameterFormData['resultType'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESULT_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unit {isNumeric ? '*' : ''}</Label>
            <Input {...form.register('unit')} disabled={readOnly} placeholder="e.g. %, mg, °C" />
            {form.formState.errors.unit && <p className="text-xs text-red-500">{form.formState.errors.unit.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Target Value</Label>
            <Input {...form.register('targetValue')} disabled={readOnly} />
          </div>
          {isNumeric && (
            <>
              <div className="space-y-2">
                <Label>Lower Limit *</Label>
                <Input {...form.register('lowerLimit')} disabled={readOnly} />
                {form.formState.errors.lowerLimit && <p className="text-xs text-red-500">{form.formState.errors.lowerLimit.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Upper Limit *</Label>
                <Input {...form.register('upperLimit')} disabled={readOnly} />
                {form.formState.errors.upperLimit && <p className="text-xs text-red-500">{form.formState.errors.upperLimit.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Alert Limit Low</Label>
                <Input {...form.register('alertLimitLow')} disabled={readOnly} />
                {form.formState.errors.alertLimitLow && <p className="text-xs text-red-500">{form.formState.errors.alertLimitLow.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Alert Limit High</Label>
                <Input {...form.register('alertLimitHigh')} disabled={readOnly} />
                {form.formState.errors.alertLimitHigh && <p className="text-xs text-red-500">{form.formState.errors.alertLimitHigh.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Action Limit Low</Label>
                <Input {...form.register('actionLimitLow')} disabled={readOnly} />
                {form.formState.errors.actionLimitLow && <p className="text-xs text-red-500">{form.formState.errors.actionLimitLow.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Action Limit High</Label>
                <Input {...form.register('actionLimitHigh')} disabled={readOnly} />
                {form.formState.errors.actionLimitHigh && <p className="text-xs text-red-500">{form.formState.errors.actionLimitHigh.message}</p>}
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={form.watch('frequency')}
              onValueChange={(v) => form.setValue('frequency', v as ParameterFormData['frequency'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Criticality</Label>
            <Select
              value={form.watch('criticality')}
              onValueChange={(v) => form.setValue('criticality', v as ParameterFormData['criticality'])}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CRITICALITY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Automation Rules</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'ootApplicable', label: 'OOT Applicable' },
            { key: 'oosApplicable', label: 'OOS Applicable' },
            { key: 'autoDeviationRequired', label: 'Auto Deviation Required' },
            { key: 'autoCapaRequired', label: 'Auto CAPA Required' },
          ].map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              <Checkbox
                checked={form.watch(item.key as keyof ParameterFormData) as boolean}
                onCheckedChange={(v) => form.setValue(item.key as keyof ParameterFormData, Boolean(v) as never)}
                disabled={readOnly}
              />
              <Label>{item.label}</Label>
            </div>
          ))}
          <div className="space-y-2 sm:col-span-2">
            <Label>Remarks</Label>
            <Textarea {...form.register('remarks')} disabled={readOnly} rows={2} />
          </div>
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Parameter'}
          </Button>
        </div>
      )}
    </form>
  );
}
