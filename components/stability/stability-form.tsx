'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  studyCreateSchema, type StudyCreateInput,
  STUDY_TYPES, STORAGE_CONDITIONS,
} from '@/lib/stability-schemas';

interface StabilityFormProps {
  defaultValues?: Partial<StudyCreateInput>;
  onSubmit: (data: StudyCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
  saving?: boolean;
}

export function StabilityForm({
  defaultValues, onSubmit, onCancel, submitLabel = 'Save Study', disabled, saving,
}: StabilityFormProps) {
  const form = useForm<StudyCreateInput>({
    resolver: zodResolver(studyCreateSchema),
    disabled,
    defaultValues: {
      product_name: '',
      generic_name: '',
      strength: '',
      dosage_form: '',
      batch_number: '',
      batch_size: '',
      manufacturing_date: '',
      expiry_date: '',
      study_type: 'Long Term',
      storage_condition: '25°C / 60% RH',
      market: 'Domestic',
      protocol_number: '',
      protocol_version: '1.0',
      study_initiation_date: new Date().toISOString().split('T')[0],
      study_end_date: null,
      remarks: '',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="product_name" render={({ field }) => (
            <FormItem><FormLabel>Product Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="generic_name" render={({ field }) => (
            <FormItem><FormLabel>Generic Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="strength" render={({ field }) => (
            <FormItem><FormLabel>Strength *</FormLabel><FormControl><Input {...field} placeholder="e.g. 500 mg" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="dosage_form" render={({ field }) => (
            <FormItem><FormLabel>Dosage Form *</FormLabel><FormControl><Input {...field} placeholder="Injection, Tablet, etc." /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="batch_number" render={({ field }) => (
            <FormItem><FormLabel>Batch Number *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="batch_size" render={({ field }) => (
            <FormItem><FormLabel>Batch Size</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="manufacturing_date" render={({ field }) => (
            <FormItem><FormLabel>Manufacturing Date *</FormLabel><FormControl><Input type="month" {...field} value={(field.value || '').slice(0, 7)} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="expiry_date" render={({ field }) => (
            <FormItem><FormLabel>Expiry Date *</FormLabel><FormControl><Input type="month" {...field} value={(field.value || '').slice(0, 7)} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="study_type" render={({ field }) => (
            <FormItem><FormLabel>Study Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{STUDY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="storage_condition" render={({ field }) => (
            <FormItem><FormLabel>Storage Condition *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{STORAGE_CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="market" render={({ field }) => (
            <FormItem><FormLabel>Market</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="protocol_number" render={({ field }) => (
            <FormItem><FormLabel>Protocol Number *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="protocol_version" render={({ field }) => (
            <FormItem><FormLabel>Protocol Version *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="study_initiation_date" render={({ field }) => (
            <FormItem><FormLabel>Study Initiation Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="study_end_date" render={({ field }) => (
            <FormItem><FormLabel>Study End Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="remarks" render={({ field }) => (
          <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
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
