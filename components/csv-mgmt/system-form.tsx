'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { systemCreateSchema, type SystemCreateInput } from '@/lib/csv-mgmt-schemas';
import { SYSTEM_TYPES, HOSTING_TYPES, CSV_STATUSES, CSV_DEPARTMENTS } from '@/lib/csv-mgmt-types';

export function SystemForm({ defaultValues, onSubmit, onCancel, submitLabel = 'Save System', saving }: {
  defaultValues?: Partial<SystemCreateInput>; onSubmit: (d: SystemCreateInput) => Promise<void>;
  onCancel?: () => void; submitLabel?: string; saving?: boolean;
}) {
  const form = useForm<SystemCreateInput>({
    resolver: zodResolver(systemCreateSchema),
    defaultValues: {
      system_name: '', system_owner: '', department: 'IT / CSV', vendor: '', system_type: 'QMS',
      business_process: '', gxp_impact: false, data_criticality: 'Medium', regulatory_impact: false,
      hosting_type: 'On-Premise', authentication_type: '', backup_required: true,
      audit_trail_required: false, e_signature_required: false, validation_status: 'Draft',
      remarks: '', ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="system_name" render={({ field }) => (
            <FormItem className="md:col-span-2"><FormLabel>System Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="system_owner" render={({ field }) => (
            <FormItem><FormLabel>System Owner *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="system_type" render={({ field }) => (
            <FormItem><FormLabel>System Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{SYSTEM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem><FormLabel>Department</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{CSV_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="vendor" render={({ field }) => (
            <FormItem><FormLabel>Vendor</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="hosting_type" render={({ field }) => (
            <FormItem><FormLabel>Hosting Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{HOSTING_TYPES.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="authentication_type" render={({ field }) => (
            <FormItem><FormLabel>Authentication</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="business_process" render={({ field }) => (
            <FormItem className="md:col-span-2"><FormLabel>Business Process</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="validation_status" render={({ field }) => (
            <FormItem><FormLabel>Validation Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{CSV_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="go_live_date" render={({ field }) => (
            <FormItem><FormLabel>Go Live Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="next_review_due" render={({ field }) => (
            <FormItem><FormLabel>Next Review Due</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl></FormItem>
          )} />
        </div>
        <div className="flex flex-wrap gap-6">
          {(['gxp_impact', 'regulatory_impact', 'backup_required', 'audit_trail_required', 'e_signature_required'] as const).map((f) => (
            <FormField key={f} control={form.control} name={f} render={({ field }) => (
              <FormItem className="flex items-center gap-2"><FormLabel className="capitalize">{f.replace(/_/g, ' ')}</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
            )} />
          ))}
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
