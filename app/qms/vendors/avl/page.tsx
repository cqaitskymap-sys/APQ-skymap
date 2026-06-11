'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useVendors, useVendorActor } from '@/hooks/use-vendor-mgmt';
import { createAvl, exportAvlCsv } from '@/lib/vendor-mgmt-service';
import { avlSchema, type AvlInput } from '@/lib/vendor-mgmt-schemas';

export default function AvlPage() {
  const { vendors, avl, loading, refresh } = useVendors({});
  const actor = useVendorActor();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<AvlInput>({
    resolver: zodResolver(avlSchema),
    defaultValues: {
      vendor_id: '', vendor_name: '', material_service: '', approval_date: '',
      approval_expiry_date: '', qualification_ref: '', audit_required: true, audit_frequency: 'Annual',
    },
  });

  const onSubmit = async (data: AvlInput) => {
    setSaving(true);
    try {
      await createAvl(data, actor);
      toast.success('AVL entry created');
      setOpen(false);
      form.reset();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const pickVendor = (id: string) => {
    const v = vendors.find((x) => x.id === id);
    if (v) {
      form.setValue('vendor_id', v.id);
      form.setValue('vendor_name', v.vendor_name);
      form.setValue('material_service', v.material_service_supplied);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Approved Vendor List</h1>
          <p className="text-muted-foreground text-sm">GMP-approved suppliers for material usage</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportAvlCsv(avl)}><Download className="h-4 w-4 mr-1" />Export</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add to AVL</Button>
        </div>
      </div>
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>AVL #</TableHead><TableHead>Vendor</TableHead><TableHead>Material</TableHead>
            <TableHead>Approval Date</TableHead><TableHead>Expiry</TableHead><TableHead>Audit Freq</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader><TableBody>
            {avl.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No AVL entries</TableCell></TableRow>
              : avl.map((a) => (
                <TableRow key={a.id}><TableCell className="font-mono text-sm">{a.avl_number}</TableCell>
                  <TableCell>{a.vendor_name}</TableCell><TableCell>{a.material_service}</TableCell>
                  <TableCell>{a.approval_date}</TableCell><TableCell>{a.approval_expiry_date}</TableCell>
                  <TableCell>{a.audit_frequency}</TableCell><TableCell>{a.status}</TableCell></TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Add AVL Entry</SheetTitle></SheetHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField control={form.control} name="vendor_id" render={({ field }) => (
              <FormItem><FormLabel>Vendor *</FormLabel>
                <Select onValueChange={(v) => pickVendor(v)} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger></FormControl>
                  <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="material_service" render={({ field }) => (
              <FormItem><FormLabel>Material / Service *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="approval_date" render={({ field }) => (
                <FormItem><FormLabel>Approval Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="approval_expiry_date" render={({ field }) => (
                <FormItem><FormLabel>Expiry Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="qualification_ref" render={({ field }) => (
              <FormItem><FormLabel>Qualification Ref</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="audit_frequency" render={({ field }) => (
              <FormItem><FormLabel>Audit Frequency</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="audit_required" render={({ field }) => (
              <FormItem className="flex items-center gap-2"><FormLabel>Audit Required</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
            )} />
            <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Create AVL'}</Button>
          </form></Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
