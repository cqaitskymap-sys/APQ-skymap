'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useTrainingDashboard, useTmsActor } from '@/hooks/use-training';
import { saveCompetency, listEmployees } from '@/lib/training-service';
import { competencySchema, type CompetencyInput } from '@/lib/training-schemas';
import { COMPETENCY_LEVELS, canManageTraining, type EmployeeProfile } from '@/lib/training-types';

export default function CompetencyAssessmentPage() {
  const { competency, loading, refresh, role } = useTrainingDashboard({});
  const actor = useTmsActor();
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);

  useEffect(() => { listEmployees().then(setEmployees); }, []);

  const form = useForm<CompetencyInput>({
    resolver: zodResolver(competencySchema),
    defaultValues: {
      employee_id: '', employee_name: '', department: '', skill: '',
      required_level: 'Competent', current_level: 'Basic', training_required: false,
    },
  });

  const onEmployeeChange = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    if (emp) {
      form.setValue('employee_id', emp.id);
      form.setValue('employee_name', emp.full_name);
      form.setValue('department', emp.department);
    }
  };

  const handleSubmit = async (data: CompetencyInput) => {
    setSaving(true);
    try {
      await saveCompetency(data, actor);
      toast.success('Competency record saved');
      form.reset();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Competency Assessment</h1>
        <p className="text-muted-foreground text-sm">Track employee skills, competency levels, and training gaps</p>
      </div>

      {canManageTraining(role) && (
        <Card><CardHeader><CardTitle className="text-base">Record Competency</CardTitle></CardHeader><CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField control={form.control} name="employee_id" render={({ field }) => (
                  <FormItem><FormLabel>Employee *</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); onEmployeeChange(v); }} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger></FormControl>
                      <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="skill" render={({ field }) => (
                  <FormItem><FormLabel>Skill *</FormLabel><FormControl><Input {...field} placeholder="e.g. HPLC Operation" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="required_level" render={({ field }) => (
                  <FormItem><FormLabel>Required Level *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{COMPETENCY_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="current_level" render={({ field }) => (
                  <FormItem><FormLabel>Current Level *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{COMPETENCY_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <Button type="submit" disabled={saving} className="bg-blue-600">{saving ? 'Saving…' : 'Save Competency'}</Button>
            </form>
          </Form>
        </CardContent></Card>
      )}

      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>Competency Records</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Skill</TableHead>
            <TableHead>Required</TableHead><TableHead>Current</TableHead><TableHead>Gap</TableHead><TableHead>Training Req.</TableHead>
          </TableRow></TableHeader><TableBody>
            {competency.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No competency records</TableCell></TableRow>
              : competency.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.employee_name}</TableCell>
                  <TableCell>{c.department}</TableCell>
                  <TableCell>{c.skill}</TableCell>
                  <TableCell>{c.required_level}</TableCell>
                  <TableCell>{c.current_level}</TableCell>
                  <TableCell className={c.gap !== 'None' ? 'text-red-600 text-sm' : 'text-green-600 text-sm'}>{c.gap}</TableCell>
                  <TableCell>{c.training_required ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
