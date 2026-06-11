'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useVendors, useVendorActor } from '@/hooks/use-vendor-mgmt';
import { createSupplierAudit } from '@/lib/vendor-mgmt-service';
import { supplierAuditSchema, type SupplierAuditInput } from '@/lib/vendor-mgmt-schemas';
import { SUPPLIER_AUDIT_TYPES, AUDIT_RATINGS } from '@/lib/vendor-mgmt-types';

export default function SupplierAuditPage() {
  const { vendors, supplierAudits, loading, refresh } = useVendors({});
  const actor = useVendorActor();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<SupplierAuditInput>({
    resolver: zodResolver(supplierAuditSchema),
    defaultValues: {
      vendor_id: '', vendor_name: '', audit_type: 'On-site Audit', audit_date: '',
      audit_scope: '', lead_auditor: '', audit_team: '', findings_count: 0,
      critical_findings: 0, major_findings: 0, minor_findings: 0,
      capa_required: false, capa_status: 'N/A', final_audit_rating: 'Satisfactory',
    },
  });

  const pickVendor = (id: string) => {
    const v = vendors.find((x) => x.id === id);
    if (v) { form.setValue('vendor_id', v.id); form.setValue('vendor_name', v.vendor_name); }
  };

  const onSubmit = async (data: SupplierAuditInput) => {
    setSaving(true);
    try {
      await createSupplierAudit(data, actor);
      toast.success('Supplier audit recorded');
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Supplier Audit</h1>
          <p className="text-muted-foreground text-sm">On-site, remote, and desktop supplier audits</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Record Audit</Button>
      </div>
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Audit #</TableHead><TableHead>Vendor</TableHead><TableHead>Type</TableHead>
            <TableHead>Date</TableHead><TableHead>Findings</TableHead><TableHead>Critical</TableHead><TableHead>Rating</TableHead><TableHead>CAPA</TableHead>
          </TableRow></TableHeader><TableBody>
            {supplierAudits.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No supplier audits</TableCell></TableRow>
              : supplierAudits.map((a) => (
                <TableRow key={a.id}><TableCell className="font-mono text-sm">{a.audit_number}</TableCell>
                  <TableCell>{a.vendor_name}</TableCell><TableCell className="text-xs">{a.audit_type}</TableCell>
                  <TableCell>{a.audit_date}</TableCell><TableCell>{a.findings_count}</TableCell>
                  <TableCell>{a.critical_findings}</TableCell><TableCell>{a.final_audit_rating}</TableCell>
                  <TableCell>{a.capa_required ? a.capa_status : 'N/A'}</TableCell></TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Record Supplier Audit</SheetTitle></SheetHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField control={form.control} name="vendor_id" render={({ field }) => (
              <FormItem><FormLabel>Vendor *</FormLabel>
                <Select onValueChange={pickVendor} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
                  <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="audit_type" render={({ field }) => (
              <FormItem><FormLabel>Audit Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{SUPPLIER_AUDIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="audit_date" render={({ field }) => (
              <FormItem><FormLabel>Audit Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="audit_scope" render={({ field }) => (
              <FormItem><FormLabel>Scope</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="lead_auditor" render={({ field }) => (
                <FormItem><FormLabel>Lead Auditor</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="final_audit_rating" render={({ field }) => (
                <FormItem><FormLabel>Rating</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{AUDIT_RATINGS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['findings_count', 'critical_findings', 'major_findings', 'minor_findings'] as const).map((f) => (
                <FormField key={f} control={form.control} name={f} render={({ field }) => (
                  <FormItem><FormLabel className="text-xs capitalize">{f.replace(/_/g, ' ')}</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl></FormItem>
                )} />
              ))}
            </div>
            <FormField control={form.control} name="capa_required" render={({ field }) => (
              <FormItem className="flex items-center gap-2"><FormLabel>CAPA Required</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
            )} />
            <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Save Audit'}</Button>
          </form></Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
