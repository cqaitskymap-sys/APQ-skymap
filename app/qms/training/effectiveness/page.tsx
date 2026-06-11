'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EffectivenessBadge } from '@/components/training/tms-sub-nav';
import { useTrainingDashboard, useTmsActor } from '@/hooks/use-training';
import { saveEffectiveness } from '@/lib/training-service';
import { effectivenessSchema, type EffectivenessInput } from '@/lib/training-schemas';
import { EFFECTIVENESS_RESULTS, canEvaluateTraining } from '@/lib/training-types';

export default function TrainingEffectivenessPage() {
  const { effectiveness, assignments, loading, refresh, role } = useTrainingDashboard({});
  const actor = useTmsActor();
  const [saving, setSaving] = useState(false);
  const completed = assignments.filter((a) => a.status === 'completed');

  const form = useForm<EffectivenessInput>({
    resolver: zodResolver(effectivenessSchema),
    defaultValues: {
      assignment_id: '', assessment_score: null, practical_observation: '',
      supervisor_feedback: '', effectiveness_result: 'Effective',
    },
  });

  const handleSubmit = async (data: EffectivenessInput) => {
    setSaving(true);
    try {
      await saveEffectiveness(data, actor);
      toast.success('Effectiveness evaluation saved');
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Training Effectiveness</h1>
        <p className="text-muted-foreground text-sm">Evaluate training effectiveness with assessment scores and supervisor feedback</p>
      </div>

      {canEvaluateTraining(role) && (
        <Card><CardHeader><CardTitle className="text-base">Record Effectiveness Evaluation</CardTitle></CardHeader><CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="assignment_id" render={({ field }) => (
                  <FormItem><FormLabel>Completed Assignment *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger></FormControl>
                      <SelectContent>{completed.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.training_number} — {a.employee_name}</SelectItem>
                      ))}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="effectiveness_result" render={({ field }) => (
                  <FormItem><FormLabel>Effectiveness Result *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{EFFECTIVENESS_RESULTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="assessment_score" render={({ field }) => (
                  <FormItem><FormLabel>Assessment Score</FormLabel>
                    <FormControl><Input type="number" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="practical_observation" render={({ field }) => (
                <FormItem><FormLabel>Practical Observation</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="supervisor_feedback" render={({ field }) => (
                <FormItem><FormLabel>Supervisor Feedback</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
              )} />
              <Button type="submit" disabled={saving} className="bg-blue-600">{saving ? 'Saving…' : 'Save Evaluation'}</Button>
            </form>
          </Form>
        </CardContent></Card>
      )}

      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>Effectiveness Records</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Training #</TableHead><TableHead>Employee</TableHead><TableHead>Score</TableHead>
            <TableHead>Result</TableHead><TableHead>Evaluated By</TableHead><TableHead>Date</TableHead>
          </TableRow></TableHeader><TableBody>
            {effectiveness.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No effectiveness records</TableCell></TableRow>
              : effectiveness.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-sm">{e.training_number}</TableCell>
                  <TableCell>{e.employee_name}</TableCell>
                  <TableCell>{e.assessment_score ?? '—'}</TableCell>
                  <TableCell><EffectivenessBadge result={e.effectiveness_result} /></TableCell>
                  <TableCell>{e.evaluated_by_name}</TableCell>
                  <TableCell>{new Date(e.evaluated_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
