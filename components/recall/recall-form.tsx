'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { recallCreateSchema, type RecallCreateInput, RECALL_TYPES, RECALL_CLASSIFICATIONS } from '@/lib/recall-schemas';

export function RecallForm({ defaultValues, onSubmit, onCancel, submitLabel = 'Save Recall', disabled, saving }: {
  defaultValues?: Partial<RecallCreateInput>; onSubmit: (d: RecallCreateInput) => Promise<void>;
  onCancel?: () => void; submitLabel?: string; disabled?: boolean; saving?: boolean;
}) {
  const form = useForm<RecallCreateInput>({
    resolver: zodResolver(recallCreateSchema), disabled,
    defaultValues: {
      recall_date: new Date().toISOString().split('T')[0], recall_type: 'Voluntary', recall_classification: 'Class II',
      product_name: '', batch_number: '', market_region: 'Domestic', reason_for_recall: '',
      recall_initiated_by_name: '', regulatory_notification_required: false,
      stock_quantity: 0, distributed_quantity: 0, recovered_quantity: 0,
      impact_assessment: '', risk_assessment: '', capa_required: false, qa_remarks: '', ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="recall_date" render={({ field }) => (<FormItem><FormLabel>Recall Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="recall_type" render={({ field }) => (<FormItem><FormLabel>Recall Type *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{RECALL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="recall_classification" render={({ field }) => (<FormItem><FormLabel>Classification *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{RECALL_CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="product_name" render={({ field }) => (<FormItem><FormLabel>Product Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="batch_number" render={({ field }) => (<FormItem><FormLabel>Batch Number *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="market_region" render={({ field }) => (<FormItem><FormLabel>Market / Region *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="recall_initiated_by_name" render={({ field }) => (<FormItem><FormLabel>Initiated By *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="stock_quantity" render={({ field }) => (<FormItem><FormLabel>Stock Quantity</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="distributed_quantity" render={({ field }) => (<FormItem><FormLabel>Distributed Quantity</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="recovered_quantity" render={({ field }) => (<FormItem><FormLabel>Recovered Quantity</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <FormField control={form.control} name="reason_for_recall" render={({ field }) => (<FormItem><FormLabel>Reason for Recall *</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>)} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="impact_assessment" render={({ field }) => (<FormItem><FormLabel>Impact Assessment</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="risk_assessment" render={({ field }) => (<FormItem><FormLabel>Risk Assessment</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="regulatory_notification_required" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>Regulatory Notification Required</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
          <FormField control={form.control} name="capa_required" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>CAPA Required</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
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
