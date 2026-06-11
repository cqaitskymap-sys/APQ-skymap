'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import {
  changeCreateSchema, type ChangeCreateInput,
  CHANGE_TYPES, CHANGE_CATEGORIES, CHANGE_PRIORITIES, CC_DEPARTMENTS, TEMPORARY_OPTIONS,
} from '@/lib/change-control-schemas';

interface CcFormProps {
  defaultValues?: Partial<ChangeCreateInput>;
  onSubmit: (data: ChangeCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
  saving?: boolean;
}

function ImpactSwitch({ form, name, label, disabled }: { form: ReturnType<typeof useForm<ChangeCreateInput>>; name: keyof ChangeCreateInput; label: string; disabled?: boolean }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className="flex items-center justify-between rounded-lg border p-3">
        <FormLabel className="text-sm">{label}</FormLabel>
        <FormControl>
          <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={disabled} />
        </FormControl>
      </FormItem>
    )} />
  );
}

export function CcForm({
  defaultValues, onSubmit, onCancel, submitLabel = 'Save Change Control', disabled, saving,
}: CcFormProps) {
  const form = useForm<ChangeCreateInput>({
    resolver: zodResolver(changeCreateSchema),
    disabled,
    defaultValues: {
      change_date: new Date().toISOString().split('T')[0],
      department: 'QA',
      initiated_by_name: '',
      product_name: '',
      batch_number: '',
      change_title: '',
      change_description: '',
      current_system: '',
      proposed_change: '',
      reason_for_change: '',
      change_type: 'Process Change',
      change_category: 'Minor',
      change_priority: 'Medium',
      temporary_permanent: 'Permanent',
      planned_implementation_date: '',
      affected_documents: '',
      affected_equipment: '',
      affected_material: '',
      affected_vendor: '',
      affected_process: '',
      affected_product: '',
      regulatory_impact: false,
      validation_impact: false,
      csv_impact: false,
      training_impact: false,
      stability_impact: false,
      quality_impact: false,
      patient_safety_impact: false,
      market_impact: false,
      risk_assessment_required: true,
      capa_required: false,
      effectiveness_check_required: true,
      qa_remarks: '',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">General Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField control={form.control} name="change_date" render={({ field }) => (
              <FormItem><FormLabel>Change Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="department" render={({ field }) => (
              <FormItem><FormLabel>Department *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{CC_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="initiated_by_name" render={({ field }) => (
              <FormItem><FormLabel>Initiated By *</FormLabel><FormControl><Input {...field} placeholder="Full name" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="product_name" render={({ field }) => (
              <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="batch_number" render={({ field }) => (
              <FormItem><FormLabel>Batch Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="change_type" render={({ field }) => (
              <FormItem><FormLabel>Change Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{CHANGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="change_category" render={({ field }) => (
              <FormItem><FormLabel>Change Category *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{CHANGE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                {field.value === 'Critical' && (
                  <FormDescription className="text-amber-600">Head QA approval is mandatory for Critical changes.</FormDescription>
                )}
                <FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="change_priority" render={({ field }) => (
              <FormItem><FormLabel>Priority *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{CHANGE_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="temporary_permanent" render={({ field }) => (
              <FormItem><FormLabel>Temporary / Permanent *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{TEMPORARY_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="planned_implementation_date" render={({ field }) => (
              <FormItem><FormLabel>Planned Implementation Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Change Description</h3>
          <FormField control={form.control} name="change_title" render={({ field }) => (
            <FormItem><FormLabel>Change Title *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="change_description" render={({ field }) => (
            <FormItem><FormLabel>Change Description *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="current_system" render={({ field }) => (
              <FormItem><FormLabel>Current System / Process *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="proposed_change" render={({ field }) => (
              <FormItem><FormLabel>Proposed Change *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="reason_for_change" render={({ field }) => (
            <FormItem><FormLabel>Reason for Change *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Affected Areas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {([
              ['affected_documents', 'Affected Documents'],
              ['affected_equipment', 'Affected Equipment'],
              ['affected_material', 'Affected Material'],
              ['affected_vendor', 'Affected Vendor'],
              ['affected_process', 'Affected Process'],
              ['affected_product', 'Affected Product'],
            ] as const).map(([name, label]) => (
              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                <FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Impact Assessment Flags</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <ImpactSwitch form={form} name="regulatory_impact" label="Regulatory Impact" disabled={disabled} />
            <ImpactSwitch form={form} name="validation_impact" label="Validation Impact" disabled={disabled} />
            <ImpactSwitch form={form} name="csv_impact" label="CSV Impact" disabled={disabled} />
            <ImpactSwitch form={form} name="training_impact" label="Training Impact" disabled={disabled} />
            <ImpactSwitch form={form} name="stability_impact" label="Stability Impact" disabled={disabled} />
            <ImpactSwitch form={form} name="quality_impact" label="Quality Impact" disabled={disabled} />
            <ImpactSwitch form={form} name="patient_safety_impact" label="Patient Safety Impact" disabled={disabled} />
            <ImpactSwitch form={form} name="market_impact" label="Market Impact" disabled={disabled} />
          </div>
          {form.watch('regulatory_impact') && (
            <p className="text-sm text-amber-600">Regulatory Affairs review will be mandatory upon approval workflow.</p>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Workflow Requirements</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField control={form.control} name="risk_assessment_required" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <FormLabel>Risk Assessment Required</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="capa_required" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <FormLabel>CAPA Required</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="effectiveness_check_required" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <FormLabel>Effectiveness Check Required</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
          </div>
          <FormField control={form.control} name="qa_remarks" render={({ field }) => (
            <FormItem><FormLabel>QA Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </section>

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
