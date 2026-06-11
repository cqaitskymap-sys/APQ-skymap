'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { assignmentSchema, type AssignmentInput } from '@/lib/training-schemas';
import { listTrainingMaster, listEmployees } from '@/lib/training-service';
import type { TrainingMaster, EmployeeProfile } from '@/lib/training-types';

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
      trainer_name: '',
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
    if (m) form.setValue('trainer_name', m.trainer_name);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="training_master_id" render={({ field }) => (
            <FormItem><FormLabel>Training *</FormLabel>
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
          <FormField control={form.control} name="trainer_name" render={({ field }) => (
            <FormItem><FormLabel>Trainer</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
        </div>
        <div className="flex gap-2 justify-end">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
}
