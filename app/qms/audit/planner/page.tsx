'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AuditStatusBadge } from '@/components/audit-mgmt/audit-sub-nav';
import { useAudits, useAuditActor } from '@/hooks/use-audit-mgmt';
import { createScheduleEntry, listSchedule } from '@/lib/audit-mgmt-service';
import { scheduleSchema, type ScheduleInput } from '@/lib/audit-mgmt-schemas';
import { AUDIT_TYPES, AUDIT_DEPARTMENTS, type AuditScheduleEntry } from '@/lib/audit-mgmt-types';

export default function AuditPlannerPage() {
  const { audits, loading } = useAudits({});
  const actor = useAuditActor();
  const [schedule, setSchedule] = useState<AuditScheduleEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { listSchedule().then(setSchedule); }, []);

  const form = useForm<ScheduleInput>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      audit_title: '', audit_type: 'Internal Audit', department: 'QA',
      planned_date: new Date().toISOString().split('T')[0], lead_auditor_name: actor.name,
    },
  });

  const handleSubmit = async (data: ScheduleInput) => {
    setSaving(true);
    try {
      await createScheduleEntry(data, actor);
      toast.success('Audit planned');
      form.reset();
      setSchedule(await listSchedule());
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
    finally { setSaving(false); }
  };

  const plannedAudits = [...schedule, ...audits.filter((a) => ['planned', 'scheduled'].includes(a.status)).map((a) => ({
    id: a.id, audit_id: a.id, audit_number: a.audit_number, audit_title: a.audit_title,
    audit_type: a.audit_type, department: a.department, planned_date: a.audit_date,
    lead_auditor_name: a.lead_auditor_name, status: a.status, created_at: a.created_at,
  }))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Audit Planner</h1>
        <p className="text-muted-foreground text-sm">Plan and schedule upcoming audits</p>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Plan New Audit</CardTitle></CardHeader><CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField control={form.control} name="audit_title" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Audit Title *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="audit_type" render={({ field }) => (
                <FormItem><FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{AUDIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem><FormLabel>Department *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{AUDIT_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="planned_date" render={({ field }) => (
                <FormItem><FormLabel>Planned Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lead_auditor_name" render={({ field }) => (
                <FormItem><FormLabel>Lead Auditor</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
            </div>
            <Button type="submit" disabled={saving} className="bg-blue-600">{saving ? 'Saving…' : 'Add to Plan'}</Button>
          </form>
        </Form>
      </CardContent></Card>
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>Audit Schedule</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Department</TableHead>
            <TableHead>Planned Date</TableHead><TableHead>Lead Auditor</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader><TableBody>
            {plannedAudits.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No planned audits</TableCell></TableRow>
              : plannedAudits.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.audit_title}</TableCell>
                  <TableCell className="text-xs">{s.audit_type}</TableCell>
                  <TableCell>{s.department}</TableCell>
                  <TableCell>{s.planned_date}</TableCell>
                  <TableCell>{s.lead_auditor_name}</TableCell>
                  <TableCell><AuditStatusBadge status={s.status} /></TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
