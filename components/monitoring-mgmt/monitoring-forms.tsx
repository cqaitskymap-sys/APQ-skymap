'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { AreaPicker, MONITORING_TYPE_UNITS, UTILITY_PARAM_UNITS } from './monitoring-filters';
import { useMonitoringActor } from '@/hooks/use-monitoring-mgmt';
import {
  environmentalSchema, utilitySchema,
  type EnvironmentalInput, type UtilityInput,
} from '@/lib/monitoring-mgmt-schemas';
import { MONITORING_TYPES, UTILITY_TYPES, UTILITY_PARAMETERS } from '@/lib/monitoring-mgmt-types';
import { createEnvironmental, createUtility } from '@/lib/monitoring-mgmt-service';
import type { AreaRecord } from '@/lib/monitoring-mgmt-types';

export function EnvironmentalForm({ areas, onSuccess }: { areas: AreaRecord[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useMonitoringActor();
  const form = useForm<EnvironmentalInput>({
    resolver: zodResolver(environmentalSchema),
    defaultValues: {
      area_doc_id: '', area_name: '', room_number: '', cleanroom_grade: 'Grade D',
      product_name: '', batch_number: '', monitoring_type: 'Temperature', parameter_name: 'Temperature',
      monitoring_date: new Date().toISOString().split('T')[0], monitoring_time: '',
      observed_value: 0, lower_limit: 18, upper_limit: 25, unit: '°C', remarks: '',
    },
  });

  const monType = form.watch('monitoring_type');
  const areaId = form.watch('area_doc_id');

  useEffect(() => {
    form.setValue('parameter_name', monType);
    form.setValue('unit', MONITORING_TYPE_UNITS[monType] || '');
    const area = areas.find((a) => a.id === areaId);
    if (area) {
      if (monType === 'Temperature' && area.temperature_limit_lower != null) {
        form.setValue('lower_limit', area.temperature_limit_lower);
        form.setValue('upper_limit', area.temperature_limit_upper ?? 25);
      }
      if (monType === 'Relative Humidity' && area.rh_limit_lower != null) {
        form.setValue('lower_limit', area.rh_limit_lower);
        form.setValue('upper_limit', area.rh_limit_upper ?? 65);
      }
      if (monType === 'Differential Pressure' && area.dp_limit_lower != null) {
        form.setValue('lower_limit', area.dp_limit_lower);
        form.setValue('upper_limit', area.dp_limit_upper ?? 15);
      }
    }
  }, [monType, areaId, areas, form]);

  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createEnvironmental(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="area_doc_id" render={() => (
        <FormItem><FormLabel>Area</FormLabel>
          <AreaPicker areas={areas} value={form.watch('area_doc_id')} onChange={(id, name, room, grade) => {
            form.setValue('area_doc_id', id); form.setValue('area_name', name);
            form.setValue('room_number', room); form.setValue('cleanroom_grade', grade);
          }} /></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="monitoring_date" render={({ field }) => (
          <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="monitoring_time" render={({ field }) => (
          <FormItem><FormLabel>Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="monitoring_type" render={({ field }) => (
        <FormItem><FormLabel>Monitoring Type</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>{MONITORING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="product_name" render={({ field }) => (
          <FormItem><FormLabel>Product</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="batch_number" render={({ field }) => (
          <FormItem><FormLabel>Batch No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField control={form.control} name="observed_value" render={({ field }) => (
          <FormItem><FormLabel>Observed Value</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="lower_limit" render={({ field }) => (
          <FormItem><FormLabel>Lower Limit</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="upper_limit" render={({ field }) => (
          <FormItem><FormLabel>Upper Limit</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="unit" render={({ field }) => (
        <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
      )} />
      <FormField control={form.control} name="remarks" render={({ field }) => (
        <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save Environmental Record</Button>
    </form></Form>
  );
}

export function UtilityForm({ onSuccess }: { onSuccess: () => void; onClose: () => void }) {
  const actor = useMonitoringActor();
  const form = useForm<UtilityInput>({
    resolver: zodResolver(utilitySchema),
    defaultValues: {
      utility_type: 'Purified Water', sampling_point: '', parameter_name: 'Conductivity',
      monitoring_date: new Date().toISOString().split('T')[0], monitoring_time: '',
      observed_value: 0, lower_limit: 0, upper_limit: 1.3, unit: 'µS/cm', remarks: '',
    },
  });

  const param = form.watch('parameter_name');
  useEffect(() => {
    form.setValue('unit', UTILITY_PARAM_UNITS[param] || '');
  }, [param, form]);

  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createUtility(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="utility_type" render={({ field }) => (
        <FormItem><FormLabel>Utility Type</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>{UTILITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select></FormItem>
      )} />
      <FormField control={form.control} name="sampling_point" render={({ field }) => (
        <FormItem><FormLabel>Sampling Point *</FormLabel><FormControl><Input {...field} placeholder="e.g. PW Loop Return" /></FormControl></FormItem>
      )} />
      <FormField control={form.control} name="parameter_name" render={({ field }) => (
        <FormItem><FormLabel>Parameter</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>{UTILITY_PARAMETERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="monitoring_date" render={({ field }) => (
          <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="monitoring_time" render={({ field }) => (
          <FormItem><FormLabel>Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField control={form.control} name="observed_value" render={({ field }) => (
          <FormItem><FormLabel>Observed Value</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="lower_limit" render={({ field }) => (
          <FormItem><FormLabel>Lower Limit</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="upper_limit" render={({ field }) => (
          <FormItem><FormLabel>Upper Limit</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="unit" render={({ field }) => (
        <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
      )} />
      <FormField control={form.control} name="remarks" render={({ field }) => (
        <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save Utility Record</Button>
    </form></Form>
  );
}
