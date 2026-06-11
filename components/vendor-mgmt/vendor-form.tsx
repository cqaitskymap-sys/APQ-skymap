'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { vendorCreateSchema, type VendorCreateInput } from '@/lib/vendor-mgmt-schemas';
import { VENDOR_TYPES, APPROVAL_STATUSES, RISK_CATEGORIES, VENDOR_STATUSES } from '@/lib/vendor-mgmt-types';

export function VendorForm({ defaultValues, onSubmit, onCancel, submitLabel = 'Save Vendor', saving }: {
  defaultValues?: Partial<VendorCreateInput>; onSubmit: (d: VendorCreateInput) => Promise<void>;
  onCancel?: () => void; submitLabel?: string; saving?: boolean;
}) {
  const form = useForm<VendorCreateInput>({
    resolver: zodResolver(vendorCreateSchema),
    defaultValues: {
      vendor_name: '', vendor_type: 'API Supplier', material_service_supplied: '', manufacturer_name: '',
      supplier_name: '', address: '', city: '', state: '', country: '', contact_person: '', email: '',
      phone: '', gst_tax_no: '', license_no: '', approval_status: 'Not Qualified', risk_category: 'Medium',
      vendor_status: 'Active', remarks: '', ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="vendor_name" render={({ field }) => (
            <FormItem className="md:col-span-2"><FormLabel>Vendor Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="vendor_type" render={({ field }) => (
            <FormItem><FormLabel>Vendor Type *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{VENDOR_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="material_service_supplied" render={({ field }) => (
            <FormItem className="md:col-span-2"><FormLabel>Material / Service *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="risk_category" render={({ field }) => (
            <FormItem><FormLabel>Risk Category *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{RISK_CATEGORIES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="manufacturer_name" render={({ field }) => (
            <FormItem><FormLabel>Manufacturer</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="supplier_name" render={({ field }) => (
            <FormItem><FormLabel>Supplier</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="contact_person" render={({ field }) => (
            <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="country" render={({ field }) => (
            <FormItem><FormLabel>Country</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="gst_tax_no" render={({ field }) => (
            <FormItem><FormLabel>GST / Tax No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="license_no" render={({ field }) => (
            <FormItem><FormLabel>License No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="approval_status" render={({ field }) => (
            <FormItem><FormLabel>Approval Status *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{APPROVAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="vendor_status" render={({ field }) => (
            <FormItem><FormLabel>Vendor Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{VENDOR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="remarks" render={({ field }) => (
          <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
        )} />
        <div className="flex gap-2 justify-end">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
}
