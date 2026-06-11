'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { auditCreateSchema, type AuditCreateInput } from '@/lib/audit-mgmt-schemas';
import { AUDIT_TYPES, AUDIT_DEPARTMENTS } from '@/lib/audit-mgmt-types';

export function AuditForm({ defaultValues, onSubmit, onCancel, submitLabel = 'Save Audit', saving }: {
  defaultValues?: Partial<AuditCreateInput>;
  onSubmit: (d: AuditCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  saving?: boolean;
}) {
  const form = useForm<AuditCreateInput>({
    resolver: zodResolver(auditCreateSchema),
    defaultValues: {
      audit_type: 'Internal Audit', audit_title: '', department: 'QA',
      audit_scope: '', audit_criteria: '', audit_date: new Date().toISOString().split('T')[0],
      audit_start_time: '09:00', audit_end_time: '17:00', lead_auditor_name: '',
      auditor_team: '', auditee: '', remarks: '', ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="audit_title" render={({ field }) => (
            <FormItem className="md:col-span-2"><FormLabel>Audit Title *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="audit_type" render={({ field }) => (
            <FormItem><FormLabel>Audit Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{AUDIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem><FormLabel>Department / Area *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{AUDIT_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="audit_date" render={({ field }) => (
            <FormItem><FormLabel>Audit Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="audit_start_time" render={({ field }) => (
            <FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="audit_end_time" render={({ field }) => (
            <FormItem><FormLabel>End Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="lead_auditor_name" render={({ field }) => (
            <FormItem><FormLabel>Lead Auditor *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="auditor_team" render={({ field }) => (
            <FormItem><FormLabel>Auditor Team</FormLabel><FormControl><Input {...field} placeholder="Comma-separated names" /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="auditee" render={({ field }) => (
            <FormItem><FormLabel>Auditee</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="audit_scope" render={({ field }) => (
          <FormItem><FormLabel>Audit Scope *</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="audit_criteria" render={({ field }) => (
          <FormItem><FormLabel>Audit Criteria *</FormLabel><FormControl><Textarea rows={2} {...field} placeholder="e.g. EU GMP Part I, ICH Q10" /></FormControl><FormMessage /></FormItem>
        )} />
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
