'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { EquipmentPicker } from './equipment-filters';
import { useEquipmentActor } from '@/hooks/use-equipment-mgmt';
import {
  calibrationSchema, pmSchema, breakdownSchema,
  type CalibrationInput, type PmInput, type BreakdownInput,
} from '@/lib/equipment-mgmt-schemas';
import {
  CALIBRATION_TYPES, CALIBRATION_STATUSES, PM_TYPES, PM_STATUSES, BREAKDOWN_STATUSES,
} from '@/lib/equipment-mgmt-types';
import { createCalibration, createPmRecord, createBreakdown } from '@/lib/equipment-mgmt-service';
import type { EquipmentRecord } from '@/lib/equipment-mgmt-types';

function useEquipPick(setValue: (k: string, v: string) => void) {
  return (docId: string, eqId: string, name: string) => {
    setValue('equipment_doc_id', docId);
    setValue('equipment_id', eqId);
    setValue('equipment_name', name);
  };
}

export function CalibrationForm({ equipment, onSuccess }: { equipment: EquipmentRecord[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useEquipmentActor();
  const form = useForm<CalibrationInput>({
    resolver: zodResolver(calibrationSchema),
    defaultValues: {
      equipment_doc_id: '', equipment_id: '', equipment_name: '',
      calibration_type: 'External', calibration_date: new Date().toISOString().split('T')[0],
      calibration_due_date: '', calibration_agency: '', certificate_no: '',
      acceptance_criteria: '', observed_result: '', calibration_status: 'Calibrated', remarks: '',
    },
  });
  const pick = useEquipPick((k, v) => form.setValue(k as keyof CalibrationInput, v));
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createCalibration(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="equipment_doc_id" render={() => (
        <FormItem><FormLabel>Equipment</FormLabel><EquipmentPicker equipment={equipment} value={form.watch('equipment_doc_id')} onChange={pick} /></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="calibration_type" render={({ field }) => (
          <FormItem><FormLabel>Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>{CALIBRATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select></FormItem>
        )} />
        <FormField control={form.control} name="calibration_status" render={({ field }) => (
          <FormItem><FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>{CALIBRATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="calibration_date" render={({ field }) => (
          <FormItem><FormLabel>Calibration Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="calibration_due_date" render={({ field }) => (
          <FormItem><FormLabel>Due Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="calibration_agency" render={({ field }) => (
        <FormItem><FormLabel>Agency</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
      )} />
      <FormField control={form.control} name="certificate_no" render={({ field }) => (
        <FormItem><FormLabel>Certificate No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
      )} />
      <FormField control={form.control} name="acceptance_criteria" render={({ field }) => (
        <FormItem><FormLabel>Acceptance Criteria</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <FormField control={form.control} name="observed_result" render={({ field }) => (
        <FormItem><FormLabel>Observed Result</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <FormField control={form.control} name="remarks" render={({ field }) => (
        <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save Calibration</Button>
    </form></Form>
  );
}

export function PmForm({ equipment, onSuccess }: { equipment: EquipmentRecord[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useEquipmentActor();
  const form = useForm<PmInput>({
    resolver: zodResolver(pmSchema),
    defaultValues: {
      equipment_doc_id: '', equipment_id: '', equipment_name: '',
      pm_type: 'Scheduled', pm_date: new Date().toISOString().split('T')[0],
      next_pm_due_date: '', checklist_completed: true, observation: '',
      spare_parts_used: '', pm_status: 'Completed', remarks: '',
    },
  });
  const pick = useEquipPick((k, v) => form.setValue(k as keyof PmInput, v));
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createPmRecord(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="equipment_doc_id" render={() => (
        <FormItem><FormLabel>Equipment</FormLabel><EquipmentPicker equipment={equipment} value={form.watch('equipment_doc_id')} onChange={pick} /></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="pm_type" render={({ field }) => (
          <FormItem><FormLabel>PM Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>{PM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select></FormItem>
        )} />
        <FormField control={form.control} name="pm_status" render={({ field }) => (
          <FormItem><FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>{PM_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="pm_date" render={({ field }) => (
          <FormItem><FormLabel>PM Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="next_pm_due_date" render={({ field }) => (
          <FormItem><FormLabel>Next Due</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="checklist_completed" render={({ field }) => (
        <FormItem className="flex items-center gap-2"><FormLabel>Checklist Completed</FormLabel>
          <Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>
      )} />
      <FormField control={form.control} name="observation" render={({ field }) => (
        <FormItem><FormLabel>Observation</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <FormField control={form.control} name="spare_parts_used" render={({ field }) => (
        <FormItem><FormLabel>Spare Parts Used</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
      )} />
      <FormField control={form.control} name="remarks" render={({ field }) => (
        <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save PM Record</Button>
    </form></Form>
  );
}

export function BreakdownForm({ equipment, onSuccess }: { equipment: EquipmentRecord[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useEquipmentActor();
  const form = useForm<BreakdownInput>({
    resolver: zodResolver(breakdownSchema),
    defaultValues: {
      equipment_doc_id: '', equipment_id: '', equipment_name: '',
      breakdown_date: new Date().toISOString().split('T')[0], problem_description: '',
      impact_on_batch: false, impact_on_product_quality: false, immediate_action: '',
      root_cause: '', corrective_action: '', start_time: '', end_time: '',
      status: 'Open', capa_required: false, deviation_required: false,
    },
  });
  const pick = useEquipPick((k, v) => form.setValue(k as keyof BreakdownInput, v));
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createBreakdown(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="equipment_doc_id" render={() => (
        <FormItem><FormLabel>Equipment</FormLabel><EquipmentPicker equipment={equipment} value={form.watch('equipment_doc_id')} onChange={pick} /></FormItem>
      )} />
      <FormField control={form.control} name="breakdown_date" render={({ field }) => (
        <FormItem><FormLabel>Breakdown Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
      )} />
      <FormField control={form.control} name="problem_description" render={({ field }) => (
        <FormItem><FormLabel>Problem Description *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="impact_on_batch" render={({ field }) => (
          <FormItem className="flex items-center gap-2"><FormLabel>Impact on Batch</FormLabel>
            <Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>
        )} />
        <FormField control={form.control} name="impact_on_product_quality" render={({ field }) => (
          <FormItem className="flex items-center gap-2"><FormLabel>Impact on Quality</FormLabel>
            <Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="immediate_action" render={({ field }) => (
        <FormItem><FormLabel>Immediate Action</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="start_time" render={({ field }) => (
          <FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="end_time" render={({ field }) => (
          <FormItem><FormLabel>End Time</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="status" render={({ field }) => (
        <FormItem><FormLabel>Status</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>{BREAKDOWN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="capa_required" render={({ field }) => (
          <FormItem className="flex items-center gap-2"><FormLabel>CAPA Required</FormLabel>
            <Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>
        )} />
        <FormField control={form.control} name="deviation_required" render={({ field }) => (
          <FormItem className="flex items-center gap-2"><FormLabel>Deviation Required</FormLabel>
            <Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>
        )} />
      </div>
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Report Breakdown</Button>
    </form></Form>
  );
}
