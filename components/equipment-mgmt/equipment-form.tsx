'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { equipmentCreateSchema, type EquipmentCreateInput } from '@/lib/equipment-mgmt-schemas';
import { EQUIPMENT_TYPES, EQUIPMENT_STATUSES, EQUIPMENT_DEPARTMENTS } from '@/lib/equipment-mgmt-types';

export function EquipmentForm({ defaultValues, onSubmit, onCancel, submitLabel = 'Save', saving }: {
  defaultValues?: Partial<EquipmentCreateInput>; onSubmit: (d: EquipmentCreateInput) => Promise<void>;
  onCancel?: () => void; submitLabel?: string; saving?: boolean;
}) {
  const form = useForm<EquipmentCreateInput>({
    resolver: zodResolver(equipmentCreateSchema),
    defaultValues: {
      equipment_name: '', equipment_type: 'Manufacturing Equipment', department: 'Production',
      area_room_no: '', make: '', model: '', serial_no: '', capacity: '',
      calibration_required: true, pm_required: true, qualification_required: false, cleaning_required: false,
      equipment_status: 'Active', remarks: '', ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="equipment_name" render={({ field }) => (
            <FormItem className="md:col-span-2"><FormLabel>Equipment Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="equipment_type" render={({ field }) => (
            <FormItem><FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{EQUIPMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem><FormLabel>Department</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{EQUIPMENT_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="area_room_no" render={({ field }) => (
            <FormItem><FormLabel>Area / Room</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="make" render={({ field }) => (
            <FormItem><FormLabel>Make</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="model" render={({ field }) => (
            <FormItem><FormLabel>Model</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="serial_no" render={({ field }) => (
            <FormItem><FormLabel>Serial No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="capacity" render={({ field }) => (
            <FormItem><FormLabel>Capacity</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="installation_date" render={({ field }) => (
            <FormItem><FormLabel>Installation Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="calibration_due_date" render={({ field }) => (
            <FormItem><FormLabel>Calibration Due</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="pm_due_date" render={({ field }) => (
            <FormItem><FormLabel>PM Due</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="equipment_status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{EQUIPMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
        </div>
        <div className="flex flex-wrap gap-6">
          {(['calibration_required', 'pm_required', 'qualification_required', 'cleaning_required'] as const).map((f) => (
            <FormField key={f} control={form.control} name={f} render={({ field }) => (
              <FormItem className="flex items-center gap-2"><FormLabel className="capitalize">{f.replace(/_/g, ' ')}</FormLabel>
                <Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>
            )} />
          ))}
        </div>
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
