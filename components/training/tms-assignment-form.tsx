'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { assignmentSchema, type AssignmentInput } from '@/lib/training-schemas';
import { listTrainingMaster, listEmployees } from '@/lib/training-service';
import { ASSIGNMENT_TRAINING_MODES, type TrainingMaster, type EmployeeProfile } from '@/lib/training-types';

export function AssignmentForm({ onSubmit, onCancel, submitLabel = 'Assign Training', saving }: {
  onSubmit: (d: AssignmentInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  saving?: boolean;
}) {
  const [masters, setMasters] = useState<TrainingMaster[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);

  useEffect(() => {
    listTrainingMaster({ status: 'Active' }).then(setMasters);
    listEmployees().then(setEmployees);
  }, []);

  const form = useForm<AssignmentInput>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      training_master_id: '', employee_id: '', employee_name: '', department: '',
      designation: '', assigned_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      trainer_name: '', training_mode: 'Classroom', effectiveness_required: false,
      effectiveness_due_date: null, remarks: '',
    },
  });

  const onEmployeeChange = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      form.setValue('employee_id', emp.id);
      form.setValue('employee_name', emp.full_name);
      form.setValue('department', emp.department);
      form.setValue('designation', emp.designation);
    }
  };

  const onMasterChange = (masterId: string) => {
    const m = masters.find((x) => x.id === masterId);
    if (m) {
      form.setValue('trainer_name', m.trainer_name);
      form.setValue('training_topic', m.training_title);
      form.setValue('training_type', m.training_type);
      form.setValue('effectiveness_required', m.effectiveness_required ?? false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="training_master_id" render={({ field }) => (
            <FormItem><FormLabel>Training Topic *</FormLabel>
              <Select onValueChange={(v) => { field.onChange(v); onMasterChange(v); }} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select training" /></SelectTrigger></FormControl>
                <SelectContent>{masters.map((m) => <SelectItem key={m.id} value={m.id}>{m.training_code} — {m.training_title}</SelectItem>)}</SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="employee_id" render={({ field }) => (
            <FormItem><FormLabel>Employee *</FormLabel>
              <Select onValueChange={(v) => { field.onChange(v); onEmployeeChange(v); }} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger></FormControl>
                <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.department})</SelectItem>)}</SelectContent>
              </Select><FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="assigned_date" render={({ field }) => (
            <FormItem><FormLabel>Assigned Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="due_date" render={({ field }) => (
            <FormItem><FormLabel>Due Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="training_mode" render={({ field }) => (
            <FormItem><FormLabel>Training Mode</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{ASSIGNMENT_TRAINING_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="trainer_name" render={({ field }) => (
            <FormItem><FormLabel>Trainer</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="remarks" render={({ field }) => (
          <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="effectiveness_required" render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            <FormLabel className="!mt-0">Effectiveness evaluation required after completion</FormLabel>
          </FormItem>
        )} />
        <div className="flex gap-2 justify-end">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
}
