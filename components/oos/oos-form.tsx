'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { oosCreateSchema, type OosCreateInput, DEPARTMENTS } from '@/lib/oos-schemas';
import { computeResultStatus } from '@/lib/oos-types';
import { ResultStatusBadge } from './oos-sub-nav';

interface OosFormProps {
  defaultValues?: Partial<OosCreateInput>;
  onSubmit: (data: OosCreateInput) => Promise<void>;
  submitLabel?: string;
  disabled?: boolean;
}

export function OosForm({ defaultValues, onSubmit, submitLabel = 'Save OOS', disabled }: OosFormProps) {
  const form = useForm<OosCreateInput>({
    resolver: zodResolver(oosCreateSchema),
    defaultValues: {
      oos_date: new Date().toISOString().split('T')[0],
      department: 'QC', product_name: '', batch_number: '', test_name: '',
      test_method: '', stp_number: '', specification_number: '', parameter_name: '',
      spec_lower_limit: 0, spec_upper_limit: 100, observed_result: 0, unit: '%',
      is_critical_test: false, target_closure_date: '', ...defaultValues,
    },
  });

  const observed = form.watch('observed_result');
  const lower = form.watch('spec_lower_limit');
  const upper = form.watch('spec_upper_limit');
  const resultStatus = computeResultStatus(Number(observed) || 0, Number(lower) || 0, Number(upper) || 0);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">OOS Header</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField control={form.control} name="oos_date" render={({ field }) => (
              <FormItem><FormLabel>OOS Date *</FormLabel><FormControl><Input type="date" {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="department" render={({ field }) => (
              <FormItem><FormLabel>Department *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="product_name" render={({ field }) => (
              <FormItem><FormLabel>Product Name *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="batch_number" render={({ field }) => (
              <FormItem><FormLabel>Batch Number *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="test_name" render={({ field }) => (
              <FormItem><FormLabel>Test Name *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="test_method" render={({ field }) => (
              <FormItem><FormLabel>Test Method *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="stp_number" render={({ field }) => (
              <FormItem><FormLabel>STP Number *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="specification_number" render={({ field }) => (
              <FormItem><FormLabel>Specification Number *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="target_closure_date" render={({ field }) => (
              <FormItem><FormLabel>Target Closure Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} disabled={disabled} /></FormControl></FormItem>
            )} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Result Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField control={form.control} name="parameter_name" render={({ field }) => (
              <FormItem><FormLabel>Parameter Name *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="spec_lower_limit" render={({ field }) => (
              <FormItem><FormLabel>Specification Lower Limit *</FormLabel><FormControl><Input type="number" step="any" {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="spec_upper_limit" render={({ field }) => (
              <FormItem><FormLabel>Specification Upper Limit *</FormLabel><FormControl><Input type="number" step="any" {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="observed_result" render={({ field }) => (
              <FormItem><FormLabel>Observed Result *</FormLabel><FormControl><Input type="number" step="any" {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="unit" render={({ field }) => (
              <FormItem><FormLabel>Unit *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormItem>
              <FormLabel>Result Status (Auto)</FormLabel>
              <div className="pt-2"><ResultStatusBadge status={resultStatus} /></div>
              <FormDescription>{resultStatus === 'OOS' ? 'OOS workflow will be triggered automatically' : 'Result within specification limits'}</FormDescription>
            </FormItem>
            <FormField control={form.control} name="is_critical_test" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-md border p-3">
                <div><FormLabel>Critical Test</FormLabel><FormDescription className="text-xs">Blocks batch release if OOS</FormDescription></div>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} /></FormControl>
              </FormItem>
            )} />
          </div>
        </div>

        {!disabled && (
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        )}
      </form>
    </Form>
  );
}
