'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { validationCreateSchema, type ValidationCreateInput } from '@/lib/validation-mgmt-schemas';
import { VALIDATION_TYPES, VALIDATION_STATUSES, VALIDATION_DEPARTMENTS } from '@/lib/validation-mgmt-types';

export function ValidationForm({ defaultValues, onSubmit, onCancel, submitLabel = 'Save', saving, lockType }: {
  defaultValues?: Partial<ValidationCreateInput>; onSubmit: (d: ValidationCreateInput) => Promise<void>;
  onCancel?: () => void; submitLabel?: string; saving?: boolean; lockType?: string;
}) {
  const form = useForm<ValidationCreateInput>({
    resolver: zodResolver(validationCreateSchema),
    defaultValues: {
      validation_type: 'IQ', validation_title: '', department: 'QA', product_name: '', batch_number: '',
      equipment_name: '', equipment_id: '', system_name: '', protocol_number: '', protocol_version: '1.0',
      report_number: '', validation_start_date: new Date().toISOString().split('T')[0], validation_end_date: '',
      validation_status: 'Draft', deviation_observed: false, capa_required: false,
      change_control_linked: false, change_control_number: '', remarks: '', is_vmp: false,
      ...defaultValues,
      ...(lockType ? { validation_type: lockType as ValidationCreateInput['validation_type'] } : {}),
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!lockType && (
            <FormField control={form.control} name="validation_type" render={({ field }) => (
              <FormItem><FormLabel>Validation Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{VALIDATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
          )}
          <FormField control={form.control} name="validation_title" render={({ field }) => (
            <FormItem className={lockType ? 'md:col-span-2' : ''}><FormLabel>Validation Title *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem><FormLabel>Department *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{VALIDATION_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="validation_status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{VALIDATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="product_name" render={({ field }) => (
            <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="batch_number" render={({ field }) => (
            <FormItem><FormLabel>Batch Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="equipment_name" render={({ field }) => (
            <FormItem><FormLabel>Equipment Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="equipment_id" render={({ field }) => (
            <FormItem><FormLabel>Equipment ID</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="system_name" render={({ field }) => (
            <FormItem><FormLabel>System Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="protocol_number" render={({ field }) => (
            <FormItem><FormLabel>Protocol Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="protocol_version" render={({ field }) => (
            <FormItem><FormLabel>Protocol Version</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="validation_start_date" render={({ field }) => (
            <FormItem><FormLabel>Start Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="validation_end_date" render={({ field }) => (
            <FormItem><FormLabel>End Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="revalidation_due_date" render={({ field }) => (
            <FormItem><FormLabel>Revalidation Due</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} onChange={field.onChange} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="change_control_number" render={({ field }) => (
            <FormItem><FormLabel>Change Control #</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
        </div>
        <div className="flex flex-wrap gap-6">
          <FormField control={form.control} name="change_control_linked" render={({ field }) => (
            <FormItem className="flex items-center gap-2"><FormLabel>Change Control Linked</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="capa_required" render={({ field }) => (
            <FormItem className="flex items-center gap-2"><FormLabel>CAPA Required</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="is_vmp" render={({ field }) => (
            <FormItem className="flex items-center gap-2"><FormLabel>Include in VMP</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="remarks" render={({ field }) => (
          <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
        )} />
        <div className="flex gap-2 justify-end">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
}
