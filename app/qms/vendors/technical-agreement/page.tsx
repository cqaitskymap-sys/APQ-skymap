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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useVendors, useVendorActor } from '@/hooks/use-vendor-mgmt';
import { createAgreement } from '@/lib/vendor-mgmt-service';
import { agreementSchema, type AgreementInput } from '@/lib/vendor-mgmt-schemas';
import { AGREEMENT_TYPES, AGREEMENT_STATUSES } from '@/lib/vendor-mgmt-types';

export default function TechnicalAgreementPage() {
  const { vendors, agreements, loading, refresh } = useVendors({});
  const actor = useVendorActor();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<AgreementInput>({
    resolver: zodResolver(agreementSchema),
    defaultValues: {
      vendor_id: '', vendor_name: '', agreement_type: 'Quality Agreement', material_service: '',
      effective_date: '', expiry_date: '', agreement_status: 'Draft', responsible_department: 'QA', remarks: '',
    },
  });

  const pickVendor = (id: string) => {
    const v = vendors.find((x) => x.id === id);
    if (v) {
      form.setValue('vendor_id', v.id);
      form.setValue('vendor_name', v.vendor_name);
      form.setValue('material_service', v.material_service_supplied);
    }
  };

  const onSubmit = async (data: AgreementInput) => {
    setSaving(true);
    try {
      await createAgreement(data, actor);
      toast.success('Agreement created');
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Technical Agreement</h1>
          <p className="text-muted-foreground text-sm">Quality, technical, and supply agreements with vendors</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New Agreement</Button>
      </div>
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Agreement #</TableHead><TableHead>Vendor</TableHead><TableHead>Type</TableHead>
            <TableHead>Effective</TableHead><TableHead>Expiry</TableHead><TableHead>Department</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader><TableBody>
            {agreements.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No agreements</TableCell></TableRow>
              : agreements.map((a) => (
                <TableRow key={a.id}><TableCell className="font-mono text-sm">{a.agreement_number}</TableCell>
                  <TableCell>{a.vendor_name}</TableCell><TableCell className="text-xs">{a.agreement_type}</TableCell>
                  <TableCell>{a.effective_date}</TableCell><TableCell>{a.expiry_date}</TableCell>
                  <TableCell>{a.responsible_department}</TableCell><TableCell>{a.agreement_status}</TableCell></TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>New Technical Agreement</SheetTitle></SheetHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField control={form.control} name="vendor_id" render={({ field }) => (
              <FormItem><FormLabel>Vendor *</FormLabel>
                <Select onValueChange={pickVendor} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
                  <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="agreement_type" render={({ field }) => (
              <FormItem><FormLabel>Agreement Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{AGREEMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="material_service" render={({ field }) => (
              <FormItem><FormLabel>Material / Service</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="effective_date" render={({ field }) => (
                <FormItem><FormLabel>Effective Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="expiry_date" render={({ field }) => (
                <FormItem><FormLabel>Expiry Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="agreement_status" render={({ field }) => (
              <FormItem><FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{AGREEMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="responsible_department" render={({ field }) => (
              <FormItem><FormLabel>Responsible Department</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
            )} />
            <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Create Agreement'}</Button>
          </form></Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
