'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  capaCreateSchema, type CapaCreateInput,
  CAPA_SOURCES, CAPA_DEPARTMENTS, CAPA_PRIORITIES,
} from '@/lib/capa-schemas';

interface CapaFormProps {
  defaultValues?: Partial<CapaCreateInput>;
  onSubmit: (data: CapaCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
  saving?: boolean;
}

export function CapaForm({
  defaultValues, onSubmit, onCancel, submitLabel = 'Save CAPA', disabled, saving,
}: CapaFormProps) {
  const form = useForm<CapaCreateInput>({
    resolver: zodResolver(capaCreateSchema),
    defaultValues: {
      capa_date: new Date().toISOString().split('T')[0],
      capa_source: 'Deviation',
      source_reference_number: '',
      department: 'QA',
      product_name: '',
      batch_number: '',
      capa_title: '',
      problem_description: '',
      root_cause: '',
      corrective_action: '',
      preventive_action: '',
      action_owner: '',
      target_completion_date: '',
      effectiveness_check_required: true,
      effectiveness_criteria: '',
      priority: 'medium',
      qa_remarks: '',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="capa_date" render={({ field }) => (
            <FormItem><FormLabel>CAPA Date *</FormLabel><FormControl><Input type="date" {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="capa_source" render={({ field }) => (
            <FormItem><FormLabel>CAPA Source *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{CAPA_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="source_reference_number" render={({ field }) => (
            <FormItem><FormLabel>Source Reference Number *</FormLabel><FormControl><Input {...field} disabled={disabled} placeholder="DEV-2025-0001, OOS-2025-0001, RISK-..." /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem><FormLabel>Department *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{CAPA_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="product_name" render={({ field }) => (
            <FormItem><FormLabel>Product Name *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="batch_number" render={({ field }) => (
            <FormItem><FormLabel>Batch Number</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="priority" render={({ field }) => (
            <FormItem><FormLabel>Priority *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{CAPA_PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="action_owner" render={({ field }) => (
            <FormItem><FormLabel>Action Owner *</FormLabel><FormControl><Input {...field} disabled={disabled} placeholder="Name or employee ID" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="target_completion_date" render={({ field }) => (
            <FormItem><FormLabel>Target Completion Date *</FormLabel><FormControl><Input type="date" {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="capa_title" render={({ field }) => (
          <FormItem><FormLabel>CAPA Title *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="problem_description" render={({ field }) => (
          <FormItem><FormLabel>Problem Description *</FormLabel><FormControl><Textarea rows={4} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="root_cause" render={({ field }) => (
          <FormItem><FormLabel>Root Cause *</FormLabel><FormControl><Textarea rows={2} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="corrective_action" render={({ field }) => (
            <FormItem><FormLabel>Corrective Action *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="preventive_action" render={({ field }) => (
            <FormItem><FormLabel>Preventive Action *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="effectiveness_check_required" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-3">
            <FormLabel>Effectiveness Check Required</FormLabel>
            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} /></FormControl>
          </FormItem>
        )} />
        {form.watch('effectiveness_check_required') && (
          <>
            <FormField control={form.control} name="effectiveness_check_date" render={({ field }) => (
              <FormItem><FormLabel>Effectiveness Check Date *</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="effectiveness_criteria" render={({ field }) => (
              <FormItem><FormLabel>Effectiveness Criteria *</FormLabel><FormControl><Textarea rows={2} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
            )} />
          </>
        )}
        <FormField control={form.control} name="qa_remarks" render={({ field }) => (
          <FormItem><FormLabel>QA Remarks</FormLabel><FormControl><Textarea rows={2} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="flex gap-2 justify-end">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>}
          <Button type="submit" disabled={disabled || saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
