'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { documentCreateSchema, type DocumentCreateInput } from '@/lib/dms-schemas';
import { DOCUMENT_TYPES, DMS_DEPARTMENTS } from '@/lib/dms-types';
import { listChangeControlsForLink } from '@/lib/dms-service';

export function DmsForm({ defaultValues, onSubmit, onCancel, submitLabel = 'Save Document', disabled, saving }: {
  defaultValues?: Partial<DocumentCreateInput>;
  onSubmit: (d: DocumentCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  disabled?: boolean;
  saving?: boolean;
}) {
  const [changeControls, setChangeControls] = useState<{ id: string; number: string; title: string }[]>([]);

  useEffect(() => {
    listChangeControlsForLink().then(setChangeControls).catch(() => {});
  }, []);

  const form = useForm<DocumentCreateInput>({
    resolver: zodResolver(documentCreateSchema),
    disabled,
    defaultValues: {
      document_title: '',
      document_type: 'SOP',
      department: 'QA',
      product_name: '',
      version: '1.0',
      effective_date: null,
      next_review_date: null,
      prepared_by_name: '',
      change_control_ref: '',
      change_control_id: null,
      supersedes_document_no: '',
      supersedes_document_id: null,
      reason_for_revision: '',
      remarks: '',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="document_title" render={({ field }) => (
            <FormItem className="md:col-span-2 lg:col-span-3">
              <FormLabel>Document Title *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="document_type" render={({ field }) => (
            <FormItem><FormLabel>Document Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem><FormLabel>Department *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{DMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="product_name" render={({ field }) => (
            <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="version" render={({ field }) => (
            <FormItem><FormLabel>Version / Revision No *</FormLabel><FormControl><Input {...field} placeholder="e.g. 1.0" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="prepared_by_name" render={({ field }) => (
            <FormItem><FormLabel>Prepared By *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="effective_date" render={({ field }) => (
            <FormItem><FormLabel>Effective Date</FormLabel>
              <FormControl><Input type="date" value={field.value || ''} onChange={(e) => field.onChange(e.target.value || null)} /></FormControl><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="next_review_date" render={({ field }) => (
            <FormItem><FormLabel>Next Review Date</FormLabel>
              <FormControl><Input type="date" value={field.value || ''} onChange={(e) => field.onChange(e.target.value || null)} /></FormControl><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="change_control_id" render={({ field }) => (
            <FormItem><FormLabel>Change Control Reference</FormLabel>
              <Select onValueChange={(v) => {
                field.onChange(v === 'none' ? null : v);
                const cc = changeControls.find((c) => c.id === v);
                if (cc) form.setValue('change_control_ref', cc.number);
              }} value={field.value || 'none'}>
                <FormControl><SelectTrigger><SelectValue placeholder="Link change control" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {changeControls.map((c) => <SelectItem key={c.id} value={c.id}>{c.number} — {c.title}</SelectItem>)}
                </SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="supersedes_document_no" render={({ field }) => (
            <FormItem><FormLabel>Supersedes Document No</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="reason_for_revision" render={({ field }) => (
          <FormItem><FormLabel>Reason for Revision</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
        )} />
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
