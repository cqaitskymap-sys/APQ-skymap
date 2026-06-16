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
import { BATCH_IMPACT_OPTIONS, TRI_STATE_IMPACT_OPTIONS, YES_NO_OPTIONS, impactToBoolean } from '@/lib/deviation-create-records';
import type { DeviationRecord } from '@/lib/deviation-types';

function boolToTriState(v?: boolean): string {
  return v ? 'Yes' : 'No';
}

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
      deviation_time: '',
      department: '',
      product_name: '',
      product_code: '',
      batch_number: '',
      market: '',
      manufacturing_date: '',
      expiry_date: '',
      area: '',
      reported_by_name: '',
      detected_by_name: '',
      category: 'Process',
      planned_type: 'Unplanned',
      criticality: 'Minor',
      title: '',
      description: '',
      immediate_action: '',
      batch_impact: 'No',
      product_quality_impact: 'No',
      patient_safety_impact: 'No',
      regulatory_impact_status: 'No',
      repeat_deviation: 'No',
      previous_deviation_reference: '',
      investigation_required: true,
      capa_required: false,
      assigned_investigator_name: '',
      qa_reviewer_name: '',
      target_closure_date: '',
      qa_remarks: '',
      remarks: '',
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
            <FormItem><FormLabel>Batch Number</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
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
            <FormItem><FormLabel>Target Closure Date *</FormLabel><FormControl><Input type="date" {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Title *</FormLabel><FormControl><Input {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description *</FormLabel><FormControl><Textarea rows={4} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="immediate_action" render={({ field }) => (
          <FormItem><FormLabel>Immediate Action *</FormLabel><FormControl><Textarea rows={3} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
        )} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border p-4 bg-muted/30">
          {([
            ['batch_impact', 'Batch Impact', BATCH_IMPACT_OPTIONS],
            ['product_quality_impact', 'Product Quality Impact', TRI_STATE_IMPACT_OPTIONS],
            ['patient_safety_impact', 'Patient Safety Impact', TRI_STATE_IMPACT_OPTIONS],
            ['regulatory_impact_status', 'Regulatory Impact', TRI_STATE_IMPACT_OPTIONS],
          ] as const).map(([name, label, options]) => (
            <FormField key={name} control={form.control} name={name} render={({ field }) => (
              <FormItem><FormLabel>{label}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
          ))}
          <FormField control={form.control} name="repeat_deviation" render={({ field }) => (
            <FormItem><FormLabel>Repeat Deviation</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{YES_NO_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
        </div>

        <FormField control={form.control} name="remarks" render={({ field }) => (
          <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} disabled={disabled} /></FormControl><FormMessage /></FormItem>
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

export function mapFormInputToRecord(input: DeviationCreateInput): Partial<DeviationRecord> {
  return {
    deviation_date: input.deviation_date,
    deviation_time: input.deviation_time,
    department: input.department,
    area: input.area,
    reported_by_name: input.reported_by_name,
    detected_by_name: input.detected_by_name,
    product_name: input.product_name,
    product_code: input.product_code,
    batch_number: input.batch_number,
    market: input.market,
    manufacturing_date: input.manufacturing_date,
    expiry_date: input.expiry_date,
    planned_type: input.planned_type as DeviationRecord['planned_type'],
    category: input.category,
    criticality: input.criticality as DeviationRecord['criticality'],
    title: input.title,
    description: input.description,
    immediate_action: input.immediate_action,
    batch_impact: input.batch_impact,
    product_quality_impact: input.product_quality_impact,
    patient_safety_impact: input.patient_safety_impact,
    regulatory_impact_status: input.regulatory_impact_status,
    batch_impacted: impactToBoolean(input.batch_impact),
    product_quality_impacted: impactToBoolean(input.product_quality_impact),
    patient_safety_impacted: impactToBoolean(input.patient_safety_impact),
    regulatory_impact: impactToBoolean(input.regulatory_impact_status),
    repeat_deviation: input.repeat_deviation === 'Yes',
    previous_deviation_reference: input.previous_deviation_reference,
    investigation_required: input.investigation_required,
    capa_required: input.capa_required,
    assigned_investigator_name: input.assigned_investigator_name || null,
    qa_reviewer_name: input.qa_reviewer_name || null,
    target_closure_date: input.target_closure_date,
    qa_remarks: input.remarks || input.qa_remarks,
    remarks: input.remarks,
  };
}

export function mapRecordToFormInput(record: Record<string, unknown>): Partial<DeviationCreateInput> {
  return {
    deviation_date: String(record.deviation_date || ''),
    deviation_time: String(record.deviation_time || ''),
    department: String(record.department || ''),
    area: String(record.area || ''),
    reported_by_name: String(record.reported_by_name || ''),
    detected_by_name: String(record.detected_by_name || ''),
    product_name: String(record.product_name || ''),
    product_code: String(record.product_code || ''),
    batch_number: String(record.batch_number || ''),
    planned_type: String(record.planned_type || 'Unplanned') as DeviationCreateInput['planned_type'],
    category: String(record.category || 'Process') as DeviationCreateInput['category'],
    criticality: String(record.criticality || 'Minor') as DeviationCreateInput['criticality'],
    title: String(record.title || ''),
    description: String(record.description || ''),
    immediate_action: String(record.immediate_action || ''),
    batch_impact: String(record.batch_impact || (record.batch_impacted ? 'Yes' : 'No')),
    product_quality_impact: String(record.product_quality_impact || boolToTriState(record.product_quality_impacted as boolean)),
    patient_safety_impact: String(record.patient_safety_impact || boolToTriState(record.patient_safety_impacted as boolean)),
    regulatory_impact_status: String(record.regulatory_impact_status || boolToTriState(record.regulatory_impact as boolean)),
    repeat_deviation: record.repeat_deviation ? 'Yes' : 'No',
    target_closure_date: String(record.target_closure_date || ''),
    assigned_investigator_name: String(record.assigned_investigator_name || ''),
    qa_reviewer_name: String(record.qa_reviewer_name || ''),
    remarks: String(record.remarks || record.qa_remarks || ''),
    capa_required: Boolean(record.capa_required),
    investigation_required: record.investigation_required !== false,
  };
}
