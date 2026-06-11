'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { areaCreateSchema, type AreaCreateInput } from '@/lib/monitoring-mgmt-schemas';
import { CLEANROOM_GRADES, AREA_STATUSES, MONITORING_DEPARTMENTS } from '@/lib/monitoring-mgmt-types';

export function AreaForm({ defaultValues, onSubmit, onCancel, submitLabel = 'Save', saving }: {
  defaultValues?: Partial<AreaCreateInput>; onSubmit: (d: AreaCreateInput) => Promise<void>;
  onCancel?: () => void; submitLabel?: string; saving?: boolean;
}) {
  const form = useForm<AreaCreateInput>({
    resolver: zodResolver(areaCreateSchema),
    defaultValues: {
      area_name: '', department: 'Production', room_number: '', cleanroom_grade: 'Grade D',
      process_area: '', monitoring_required: true, area_status: 'Active', remarks: '',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormField control={form.control} name="area_name" render={({ field }) => (
            <FormItem className="md:col-span-2"><FormLabel>Area Name *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="department" render={({ field }) => (
            <FormItem><FormLabel>Department</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{MONITORING_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="room_number" render={({ field }) => (
            <FormItem><FormLabel>Room Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="cleanroom_grade" render={({ field }) => (
            <FormItem><FormLabel>Cleanroom Grade</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{CLEANROOM_GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="process_area" render={({ field }) => (
            <FormItem><FormLabel>Process Area</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="area_status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{AREA_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></FormItem>
          )} />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Limits (optional defaults for monitoring)</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {([
            ['temperature_limit_lower', 'Temp Lower (°C)'], ['temperature_limit_upper', 'Temp Upper (°C)'],
            ['rh_limit_lower', 'RH Lower (%)'], ['rh_limit_upper', 'RH Upper (%)'],
            ['dp_limit_lower', 'DP Lower (Pa)'], ['dp_limit_upper', 'DP Upper (Pa)'],
          ] as const).map(([name, label]) => (
            <FormField key={name} control={form.control} name={name} render={({ field }) => (
              <FormItem><FormLabel>{label}</FormLabel><FormControl><Input type="number" step="0.1" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} /></FormControl></FormItem>
            )} />
          ))}
        </div>
        <FormField control={form.control} name="monitoring_required" render={({ field }) => (
          <FormItem className="flex items-center gap-2"><FormLabel>Monitoring Required</FormLabel>
            <Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>
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
