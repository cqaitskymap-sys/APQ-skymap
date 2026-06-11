'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { complaintCreateSchema, type ComplaintCreateInput, COMPLAINT_CATEGORIES, COMPLAINT_CRITICALITIES, RECEIVED_FROM_OPTIONS } from '@/lib/complaint-schemas';

export function ComplaintForm({ defaultValues, onSubmit, onCancel, submitLabel = 'Save Complaint', disabled, saving }: {
  defaultValues?: Partial<ComplaintCreateInput>; onSubmit: (d: ComplaintCreateInput) => Promise<void>;
  onCancel?: () => void; submitLabel?: string; disabled?: boolean; saving?: boolean;
}) {
  const form = useForm<ComplaintCreateInput>({
    resolver: zodResolver(complaintCreateSchema), disabled,
    defaultValues: {
      complaint_date: new Date().toISOString().split('T')[0], received_from: 'Customer',
      customer_name: '', customer_contact: '', market_region: 'Domestic', product_name: '', batch_number: '',
      mfg_date: '', exp_date: '', complaint_category: 'Quality Defect', complaint_description: '',
      sample_received: false, retain_sample_required: false, complaint_criticality: 'Minor',
      initial_assessment: '', investigation_required: true, product_safety_impact: false, qa_remarks: '', ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="complaint_date" render={({ field }) => (<FormItem><FormLabel>Complaint Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="received_from" render={({ field }) => (<FormItem><FormLabel>Received From *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{RECEIVED_FROM_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="customer_name" render={({ field }) => (<FormItem><FormLabel>Customer Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="customer_contact" render={({ field }) => (<FormItem><FormLabel>Customer Contact</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="market_region" render={({ field }) => (<FormItem><FormLabel>Market / Region *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="product_name" render={({ field }) => (<FormItem><FormLabel>Product Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="batch_number" render={({ field }) => (<FormItem><FormLabel>Batch Number *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="mfg_date" render={({ field }) => (<FormItem><FormLabel>MFG Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="exp_date" render={({ field }) => (<FormItem><FormLabel>EXP Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="complaint_category" render={({ field }) => (<FormItem><FormLabel>Category *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{COMPLAINT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="complaint_criticality" render={({ field }) => (<FormItem><FormLabel>Criticality *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{COMPLAINT_CRITICALITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
        </div>
        <FormField control={form.control} name="complaint_description" render={({ field }) => (<FormItem><FormLabel>Complaint Description *</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="initial_assessment" render={({ field }) => (<FormItem><FormLabel>Initial Assessment</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {([['sample_received', 'Sample Received'], ['retain_sample_required', 'Retain Sample Required'], ['investigation_required', 'Investigation Required'], ['product_safety_impact', 'Product Safety Impact']] as const).map(([name, label]) => (
            <FormField key={name} control={form.control} name={name} render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel className="text-sm">{label}</FormLabel><FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={disabled} /></FormControl></FormItem>
            )} />
          ))}
        </div>
        <FormField control={form.control} name="qa_remarks" render={({ field }) => (<FormItem><FormLabel>QA Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
        <div className="flex gap-2 justify-end">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>}
          <Button type="submit" disabled={disabled || saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
}
