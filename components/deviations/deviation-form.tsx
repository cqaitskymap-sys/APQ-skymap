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
  deviationCreateSchema, type DeviationCreateInput,
  DEPARTMENTS, DEVIATION_CATEGORIES, DEVIATION_PLANNED_TYPES, DEVIATION_CRITICALITIES,
} from '@/lib/deviation-schemas';

interface DeviationFormProps {
  defaultValues?: Partial<DeviationCreateInput>;
  onSubmit: (data: DeviationCreateInput) => Promise<void>;
  submitLabel?: string;
  disabled?: boolean;
}

export function DeviationForm({ defaultValues, onSubmit, submitLabel = 'Save Deviation', disabled }: DeviationFormProps) {
  const form = useForm<DeviationCreateInput>({
    resolver: zodResolver(deviationCreateSchema),
    defaultValues: {
      deviation_date: new Date().toISOString().split('T')[0],
      department: '',
      product_name: '',
      batch_number: '',
      area: '',
      reported_by_name: '',
      detected_by_name: '',
      category: 'Process',
      planned_type: 'Unplanned',
      criticality: 'Minor',
      title: '',
      description: '',
      immediate_action: '',
      batch_impacted: false,
      product_quality_impacted: false,
      patient_safety_impacted: false,
      regulatory_impact: false,
      repeat_deviation: false,
      target_closure_date: '',
      qa_remarks: '',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="deviation_date" render={({ field }) => (
            <FormItem><FormLabel>Deviation Date *</FormLabel><FormControl><Input type="date" {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem><FormLabel>Department *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="product_name" render={({ field }) => (
            <FormItem><FormLabel>Product Name *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="batch_number" render={({ field }) => (
            <FormItem><FormLabel>Batch Number</FormLabel><FormControl><Input {...field} disabled={disabled} placeholder="Links to PQR / CPV batch data" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="area" render={({ field }) => (
            <FormItem><FormLabel>Area / Location *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="reported_by_name" render={({ field }) => (
            <FormItem><FormLabel>Reported By *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="detected_by_name" render={({ field }) => (
            <FormItem><FormLabel>Detected By *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem><FormLabel>Category *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{DEVIATION_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="planned_type" render={({ field }) => (
            <FormItem><FormLabel>Deviation Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{DEVIATION_PLANNED_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="criticality" render={({ field }) => (
            <FormItem><FormLabel>Criticality *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{DEVIATION_CRITICALITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="target_closure_date" render={({ field }) => (
            <FormItem><FormLabel>Target Closure Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Title *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
        )} />

        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Deviation Description *</FormLabel><FormControl><Textarea rows={4} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
        )} />

        <FormField control={form.control} name="immediate_action" render={({ field }) => (
          <FormItem><FormLabel>Immediate Action Taken *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-lg border p-4 bg-muted/30">
          {([
            ['batch_impacted', 'Is Batch Impacted?'],
            ['product_quality_impacted', 'Is Product Quality Impacted?'],
            ['patient_safety_impacted', 'Is Patient Safety Impacted?'],
            ['regulatory_impact', 'Is Regulatory Impact?'],
            ['repeat_deviation', 'Is Repeat Deviation?'],
          ] as const).map(([name, label]) => (
            <FormField key={name} control={form.control} name={name} render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
                <FormLabel className="text-sm font-normal">{label}</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} /></FormControl>
              </FormItem>
            )} />
          ))}
        </div>

        <FormField control={form.control} name="qa_remarks" render={({ field }) => (
          <FormItem><FormLabel>QA Remarks</FormLabel><FormControl><Textarea rows={2} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
        )} />

        {!disabled && (
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        )}
      </form>
    </Form>
  );
}
