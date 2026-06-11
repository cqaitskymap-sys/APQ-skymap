'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PerformanceBadge } from '@/components/vendor-mgmt/vendor-sub-nav';
import { useVendors, useVendorActor } from '@/hooks/use-vendor-mgmt';
import { savePerformance } from '@/lib/vendor-mgmt-service';
import { performanceSchema, type PerformanceInput } from '@/lib/vendor-mgmt-schemas';
import { calcPerformanceScore } from '@/lib/vendor-mgmt-types';

export default function PerformancePage() {
  const { vendors, performance, loading, refresh } = useVendors({});
  const actor = useVendorActor();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<PerformanceInput>({
    resolver: zodResolver(performanceSchema),
    defaultValues: {
      vendor_id: '', vendor_name: '', review_period: '', material_service: '',
      total_lots_received: 0, approved_lots: 0, rejected_lots: 0,
      on_time_deliveries: 0, delayed_deliveries: 0, complaints: 0,
      deviations: 0, oos_linked: 0, capa_linked: 0, audit_findings: 0, recommendation: '',
    },
  });

  const watched = form.watch(['total_lots_received', 'approved_lots', 'rejected_lots', 'on_time_deliveries', 'delayed_deliveries', 'complaints']);
  const preview = calcPerformanceScore({
    total_lots_received: watched[0] || 0, approved_lots: watched[1] || 0, rejected_lots: watched[2] || 0,
    on_time_deliveries: watched[3] || 0, delayed_deliveries: watched[4] || 0, complaints: watched[5] || 0,
  });

  const pickVendor = (id: string) => {
    const v = vendors.find((x) => x.id === id);
    if (v) {
      form.setValue('vendor_id', v.id);
      form.setValue('vendor_name', v.vendor_name);
      form.setValue('material_service', v.material_service_supplied);
    }
  };

  const onSubmit = async (data: PerformanceInput) => {
    setSaving(true);
    try {
      await savePerformance(data, actor);
      toast.success('Performance review saved');
      setOpen(false);
      form.reset();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vendor Performance</h1>
          <p className="text-muted-foreground text-sm">Lot acceptance, delivery, and complaint metrics</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New Review</Button>
      </div>
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Vendor</TableHead><TableHead>Period</TableHead><TableHead>Score</TableHead>
            <TableHead>Rating</TableHead><TableHead>Approval %</TableHead><TableHead>On-Time %</TableHead><TableHead>Recommendation</TableHead>
          </TableRow></TableHeader><TableBody>
            {performance.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No performance reviews</TableCell></TableRow>
              : performance.map((p) => (
                <TableRow key={p.id}><TableCell>{p.vendor_name}</TableCell><TableCell>{p.review_period}</TableCell>
                  <TableCell className="font-bold">{p.performance_score}%</TableCell>
                  <TableCell><PerformanceBadge rating={p.performance_rating} /></TableCell>
                  <TableCell>{p.approval_percent}%</TableCell><TableCell>{p.on_time_percent}%</TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs">{p.recommendation || '—'}</TableCell></TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Vendor Performance Review</SheetTitle></SheetHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField control={form.control} name="vendor_id" render={({ field }) => (
              <FormItem><FormLabel>Vendor *</FormLabel>
                <Select onValueChange={pickVendor} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
                  <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="review_period" render={({ field }) => (
              <FormItem><FormLabel>Review Period *</FormLabel><FormControl><Input placeholder="e.g. 2026-Q1" {...field} /></FormControl></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              {([
                ['total_lots_received', 'Total Lots'], ['approved_lots', 'Approved'], ['rejected_lots', 'Rejected'],
                ['on_time_deliveries', 'On-Time'], ['delayed_deliveries', 'Delayed'], ['complaints', 'Complaints'],
                ['deviations', 'Deviations'], ['oos_linked', 'OOS'], ['capa_linked', 'CAPA'], ['audit_findings', 'Audit Findings'],
              ] as const).map(([name, label]) => (
                <FormField key={name} control={form.control} name={name} render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl></FormItem>
                )} />
              ))}
            </div>
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p>Calculated Score: <strong>{preview.performance_score}%</strong> — {preview.performance_rating}</p>
              <p className="text-xs text-muted-foreground">Approval {preview.approval_percent}% · On-time {preview.on_time_percent}% · Rejection {preview.rejection_percent}%</p>
            </div>
            <FormField control={form.control} name="recommendation" render={({ field }) => (
              <FormItem><FormLabel>Recommendation</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
            )} />
            <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Save Review'}</Button>
          </form></Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
