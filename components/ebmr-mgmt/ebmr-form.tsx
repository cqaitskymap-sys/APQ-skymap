'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { ebmrCreateSchema, type EbmrCreateInput } from '@/lib/ebmr-mgmt-schemas';
import type { EbmrRecord } from '@/lib/ebmr-mgmt-types';
import { isOndansetronProduct, ONDANSETRON_BATCH_DEFAULTS } from '@/lib/ondansetron-bmr-spec';

export function EbmrForm({
  defaultValues, onSubmit, onCancel, submitLabel = 'Create Batch Record', disabled = false,
}: {
  defaultValues?: Partial<EbmrRecord>;
  onSubmit: (data: EbmrCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const form = useForm<EbmrCreateInput>({
    resolver: zodResolver(ebmrCreateSchema),
    defaultValues: {
      product_name: defaultValues?.product_name || '',
      generic_name: defaultValues?.generic_name || '',
      strength: defaultValues?.strength || '',
      batch_number: defaultValues?.batch_number || '',
      batch_size: defaultValues?.batch_size || '',
      batch_size_litres: defaultValues?.batch_size_litres ?? undefined,
      std_fill_volume_ml: defaultValues?.std_fill_volume_ml ?? undefined,
      batch_size_nos: defaultValues?.batch_size_nos ?? undefined,
      mfg_date: defaultValues?.mfg_date || new Date().toISOString().split('T')[0],
      exp_date: defaultValues?.exp_date || '',
      mfr_number: defaultValues?.mfr_number || '',
      bmr_version: defaultValues?.bmr_version || '1.0',
      manufacturing_license_no: defaultValues?.manufacturing_license_no || '',
      manufacturing_area: defaultValues?.manufacturing_area || '',
      market: defaultValues?.market || '',
      customer: defaultValues?.customer || '',
      remarks: defaultValues?.remarks || '',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="product_name" render={({ field }) => (
            <FormItem><FormLabel>Product Name *</FormLabel>
              <FormControl><Input {...field} disabled={disabled} onBlur={(e) => {
                field.onBlur();
                if (isOndansetronProduct(e.target.value) && !form.getValues('batch_size_litres')) {
                  form.setValue('generic_name', ONDANSETRON_BATCH_DEFAULTS.genericName);
                  form.setValue('strength', ONDANSETRON_BATCH_DEFAULTS.strength);
                  form.setValue('batch_size', ONDANSETRON_BATCH_DEFAULTS.batchSizeDisplay);
                  form.setValue('batch_size_litres', ONDANSETRON_BATCH_DEFAULTS.batchSizeLitres);
                  form.setValue('std_fill_volume_ml', ONDANSETRON_BATCH_DEFAULTS.stdFillVolumeMl);
                  form.setValue('batch_size_nos', ONDANSETRON_BATCH_DEFAULTS.batchSizeNos);
                  form.setValue('bmr_version', ONDANSETRON_BATCH_DEFAULTS.bmrVersion);
                }
              }} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="generic_name" render={({ field }) => (
            <FormItem><FormLabel>Generic Name</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="strength" render={({ field }) => (
            <FormItem><FormLabel>Strength</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="batch_number" render={({ field }) => (
            <FormItem><FormLabel>Batch Number *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="batch_size" render={({ field }) => (
            <FormItem><FormLabel>Batch Size</FormLabel><FormControl><Input {...field} disabled={disabled} placeholder="e.g. 400000 nos / 860 L" /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="batch_size_litres" render={({ field }) => (
            <FormItem><FormLabel>Batch Size (Litre)</FormLabel>
              <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="std_fill_volume_ml" render={({ field }) => (
            <FormItem><FormLabel>Std. Fill Vol. (mL)</FormLabel>
              <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="batch_size_nos" render={({ field }) => (
            <FormItem><FormLabel>Batch Size (Nos.)</FormLabel>
              <FormControl><Input type="number" step="1" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="mfr_number" render={({ field }) => (
            <FormItem><FormLabel>MFR Number</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="bmr_version" render={({ field }) => (
            <FormItem><FormLabel>BMR Version</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="manufacturing_license_no" render={({ field }) => (
            <FormItem><FormLabel>Manufacturing License No</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="manufacturing_area" render={({ field }) => (
            <FormItem><FormLabel>Manufacturing Area</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="market" render={({ field }) => (
            <FormItem><FormLabel>Market</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="customer" render={({ field }) => (
            <FormItem><FormLabel>Customer</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="mfg_date" render={({ field }) => (
            <FormItem><FormLabel>MFG Date *</FormLabel><FormControl><Input type="month" {...field} value={(field.value || '').slice(0, 7)} disabled={disabled} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="exp_date" render={({ field }) => (
            <FormItem><FormLabel>EXP Date *</FormLabel><FormControl><Input type="month" {...field} value={(field.value || '').slice(0, 7)} disabled={disabled} /></FormControl></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="remarks" render={({ field }) => (
          <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} disabled={disabled} /></FormControl></FormItem>
        )} />
        <div className="flex gap-2">
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={disabled}>{submitLabel}</Button>
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        </div>
      </form>
    </Form>
  );
}
