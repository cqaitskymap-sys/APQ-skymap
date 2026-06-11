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
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ApprovalBadge } from '@/components/vendor-mgmt/vendor-sub-nav';
import { useVendors, useVendorActor } from '@/hooks/use-vendor-mgmt';
import { createQualification, finalizeQualification } from '@/lib/vendor-mgmt-service';
import { qualificationSchema, type QualificationInput } from '@/lib/vendor-mgmt-schemas';
import { QUALIFICATION_TYPES } from '@/lib/vendor-mgmt-types';
import { canApproveVendor } from '@/lib/vendor-mgmt-types';

export default function QualificationPage() {
  const { vendors, qualifications, loading, refresh } = useVendors({});
  const actor = useVendorActor();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<QualificationInput>({
    resolver: zodResolver(qualificationSchema),
    defaultValues: {
      vendor_id: '', vendor_name: '', vendor_type: '', qualification_type: 'New Vendor',
      material_service: '', document_review_status: 'Pending', sample_evaluation_required: false,
      sample_evaluation_status: 'N/A', audit_required: false, audit_status: 'Pending',
      risk_assessment_score: 0, qualification_decision: 'More Information Required', remarks: '',
    },
  });

  const pickVendor = (id: string) => {
    const v = vendors.find((x) => x.id === id);
    if (v) {
      form.setValue('vendor_id', v.id);
      form.setValue('vendor_name', v.vendor_name);
      form.setValue('vendor_type', v.vendor_type);
      form.setValue('material_service', v.material_service_supplied);
    }
  };

  const onSubmit = async (data: QualificationInput) => {
    setSaving(true);
    try {
      await createQualification(data, actor);
      toast.success('Qualification initiated');
      setOpen(false);
      form.reset();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async (id: string, decision: string) => {
    try {
      await finalizeQualification(id, decision, actor);
      toast.success(`Qualification ${decision}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vendor Qualification</h1>
          <p className="text-muted-foreground text-sm">New vendor qualification, requalification, and periodic review</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New Qualification</Button>
      </div>
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Number</TableHead><TableHead>Vendor</TableHead><TableHead>Type</TableHead>
            <TableHead>Material</TableHead><TableHead>Decision</TableHead><TableHead>Risk Score</TableHead><TableHead>Actions</TableHead>
          </TableRow></TableHeader><TableBody>
            {qualifications.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No qualifications</TableCell></TableRow>
              : qualifications.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-sm">{q.qualification_number}</TableCell>
                  <TableCell>{q.vendor_name}</TableCell><TableCell className="text-xs">{q.qualification_type}</TableCell>
                  <TableCell className="max-w-[140px] truncate text-xs">{q.material_service}</TableCell>
                  <TableCell><ApprovalBadge status={q.qualification_decision} /></TableCell>
                  <TableCell>{q.risk_assessment_score}</TableCell>
                  <TableCell>
                    {canApproveVendor(actor.role) && q.qualification_decision === 'More Information Required' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleFinalize(q.id, 'Approved')}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => handleFinalize(q.id, 'Rejected')}>Reject</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>New Qualification</SheetTitle></SheetHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField control={form.control} name="vendor_id" render={({ field }) => (
              <FormItem><FormLabel>Vendor *</FormLabel>
                <Select onValueChange={pickVendor} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
                  <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="qualification_type" render={({ field }) => (
              <FormItem><FormLabel>Qualification Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{QUALIFICATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="material_service" render={({ field }) => (
              <FormItem><FormLabel>Material / Service</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="risk_assessment_score" render={({ field }) => (
              <FormItem><FormLabel>Risk Score (0-100)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="sample_evaluation_required" render={({ field }) => (
              <FormItem className="flex items-center gap-2"><FormLabel>Sample Evaluation</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="audit_required" render={({ field }) => (
              <FormItem className="flex items-center gap-2"><FormLabel>Audit Required</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
            )} />
            <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Create Qualification'}</Button>
          </form></Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
