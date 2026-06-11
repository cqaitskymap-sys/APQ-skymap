'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { trainingMasterSchema, type TrainingMasterInput } from '@/lib/training-schemas';
import { TRAINING_TYPES, TRAINING_CATEGORIES, TMS_DEPARTMENTS } from '@/lib/training-types';

export function TrainingMasterForm({ defaultValues, onSubmit, onCancel, submitLabel = 'Save Training', saving }: {
  defaultValues?: Partial<TrainingMasterInput>;
  onSubmit: (d: TrainingMasterInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  saving?: boolean;
}) {
  const form = useForm<TrainingMasterInput>({
    resolver: zodResolver(trainingMasterSchema),
    defaultValues: {
      training_title: '', training_type: 'GMP Training', department: 'QA', category: 'Initial',
      training_duration: '', trainer_name: '', training_material: '', assessment_required: true,
      passing_percentage: 80, retraining_frequency: 'Annual', status: 'Active', ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="training_title" render={({ field }) => (
            <FormItem className="md:col-span-2"><FormLabel>Training Title *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="training_type" render={({ field }) => (
            <FormItem><FormLabel>Training Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem><FormLabel>Department *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem><FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{TRAINING_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="training_duration" render={({ field }) => (
            <FormItem><FormLabel>Duration</FormLabel><FormControl><Input {...field} placeholder="e.g. 2 hours" /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="trainer_name" render={({ field }) => (
            <FormItem><FormLabel>Trainer Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="passing_percentage" render={({ field }) => (
            <FormItem><FormLabel>Passing %</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="retraining_frequency" render={({ field }) => (
            <FormItem><FormLabel>Retraining Frequency</FormLabel><FormControl><Input {...field} placeholder="Annual" /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="assessment_required" render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <FormLabel>Assessment Required</FormLabel>
              <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="training_material" render={({ field }) => (
          <FormItem><FormLabel>Training Material (URL / Reference)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
        )} />
        <div className="flex gap-2 justify-end">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
}
