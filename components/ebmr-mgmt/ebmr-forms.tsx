'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEbmrActor } from '@/hooks/use-ebmr-mgmt';
import {
  lineClearanceSchema, ebmrDispensingSchema, manufacturingStepSchema, equipmentUsageSchema,
  cppRecordSchema, ipcCheckSchema, ebmrReviewSchema, ebmrReleaseSchema,
  type LineClearanceInput, type EbmrDispensingInput, type ManufacturingStepInput,
  type EquipmentUsageInput, type CppRecordInput, type IpcCheckInput,
  type EbmrReviewInput, type EbmrReleaseInput,
} from '@/lib/ebmr-mgmt-schemas';
import {
  saveLineClearance, saveEbmrDispensing, saveManufacturingStep, saveEquipmentUsage,
  saveCppRecord, saveIpcCheck, saveEbmrReview, releaseEbmr,
} from '@/lib/ebmr-mgmt-service';
import {
  PROCESS_STAGES, IPC_CHECK_NAMES, STEP_STATUSES, COMPLIANCE_STATUSES, MATERIAL_TYPES,
  canVerifyLineClearance, canExecuteManufacturing, canEnterIpc, canReleaseBatch, isEbmrEditable,
} from '@/lib/ebmr-mgmt-types';
import type { EbmrRecord } from '@/lib/ebmr-mgmt-types';
import {
  getAllBmrCppParameters, getAllBmrIpcParameters, getCppDefaults, getIpcSpecification,
  isOndansetronProduct, ONDANSETRON_DISPENSING_MATERIALS,
} from '@/lib/ondansetron-bmr-spec';
import { listSelectableEquipment } from '@/lib/equipment-mgmt-service';
import type { EquipmentRecord } from '@/lib/equipment-mgmt-types';

function nowLocal() { return new Date().toISOString().slice(0, 16); }

export function LineClearanceForm({ ebmr, onSuccess }: { ebmr: EbmrRecord; onSuccess: () => void }) {
  const actor = useEbmrActor();
  const editable = isEbmrEditable(ebmr);
  const form = useForm<LineClearanceInput>({
    resolver: zodResolver(lineClearanceSchema),
    defaultValues: {
      ebmr_doc_id: ebmr.id, area_name: ebmr.manufacturing_area || '', room_number: '',
      previous_product: '', previous_batch_number: '', area_cleaned: false, equipment_cleaned: false,
      documents_removed: false, material_removed: false, status_label_verified: false,
      checked_by_name: '', clearance_datetime: nowLocal(), qa_verified: false, remarks: '',
    },
  });

  return (
    <Card><CardHeader><CardTitle className="text-base">Record Line Clearance</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}><form onSubmit={form.handleSubmit(async (d) => {
          try {
            if (d.qa_verified && !canVerifyLineClearance(actor.role)) throw new Error('QA role required for verification');
            await saveLineClearance(d, actor);
            toast.success('Line clearance saved');
            onSuccess();
          } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
        })} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField control={form.control} name="area_name" render={({ field }) => (
              <FormItem><FormLabel>Area Name *</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="room_number" render={({ field }) => (
              <FormItem><FormLabel>Room Number</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="previous_product" render={({ field }) => (
              <FormItem><FormLabel>Previous Product</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="previous_batch_number" render={({ field }) => (
              <FormItem><FormLabel>Previous Batch</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="clearance_datetime" render={({ field }) => (
              <FormItem><FormLabel>Date Time</FormLabel><FormControl><Input type="datetime-local" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="checked_by_name" render={({ field }) => (
              <FormItem><FormLabel>Checked By</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
          </div>
          {(['area_cleaned', 'equipment_cleaned', 'documents_removed', 'material_removed', 'status_label_verified'] as const).map((name) => (
            <FormField key={name} control={form.control} name={name} render={({ field }) => (
              <FormItem className="flex items-center gap-2"><FormLabel className="capitalize">{name.replace(/_/g, ' ')}</FormLabel>
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!editable} /></FormItem>
            )} />
          ))}
          {canVerifyLineClearance(actor.role) && (
            <FormField control={form.control} name="qa_verified" render={({ field }) => (
              <FormItem className="flex items-center gap-2"><FormLabel>QA Verified</FormLabel>
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!editable} /></FormItem>
            )} />
          )}
          <FormField control={form.control} name="remarks" render={({ field }) => (
            <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} disabled={!editable} /></FormControl></FormItem>
          )} />
          {editable && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Line Clearance</Button>}
        </form></Form>
      </CardContent></Card>
  );
}

export function DispensingForm({ ebmr, onSuccess }: { ebmr: EbmrRecord; onSuccess: () => void }) {
  const actor = useEbmrActor();
  const editable = isEbmrEditable(ebmr);
  const ondansetron = isOndansetronProduct(ebmr.product_name);
  const form = useForm<EbmrDispensingInput>({
    resolver: zodResolver(ebmrDispensingSchema),
    defaultValues: {
      ebmr_doc_id: ebmr.id, material_type: 'API', material_name: '', material_code: '', ar_number: '',
      material_mfg_date: '', material_exp_date: '', vendor_name: '',
      required_quantity: 0, dispensed_quantity: 0, unit: 'kg', checked_by_name: '',
      qa_verified_by_name: '', verified: false, remarks: '',
    },
  });

  const applyMaterialPreset = (index: number) => {
    const preset = ONDANSETRON_DISPENSING_MATERIALS[index];
    if (!preset) return;
    form.setValue('material_type', preset.materialType);
    form.setValue('material_name', preset.materialName);
    form.setValue('material_code', preset.materialCode);
    form.setValue('unit', preset.unit);
    if ('requiredQuantity' in preset) form.setValue('required_quantity', preset.requiredQuantity);
    form.setValue('remarks', preset.remarks);
  };

  return (
    <Card><CardHeader><CardTitle className="text-base">Dispensing Verification</CardTitle></CardHeader>
      <CardContent>
        {ondansetron && editable && (
          <div className="flex flex-wrap gap-2 mb-3">
            {ONDANSETRON_DISPENSING_MATERIALS.map((m, i) => (
              <Button key={m.materialCode} type="button" variant="outline" size="sm" onClick={() => applyMaterialPreset(i)}>
                Use {m.materialType}: {m.materialCode}
              </Button>
            ))}
          </div>
        )}
        <Form {...form}><form onSubmit={form.handleSubmit(async (d) => {
          try {
            await saveEbmrDispensing(d, actor);
            toast.success('Dispensing record saved');
            form.reset({
              ...form.getValues(), material_type: 'API', material_name: '', material_code: '', ar_number: '',
              material_mfg_date: '', material_exp_date: '', vendor_name: '',
              required_quantity: 0, dispensed_quantity: 0, remarks: '',
            });
            onSuccess();
          } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
        })} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField control={form.control} name="material_type" render={({ field }) => (
              <FormItem><FormLabel>Material Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!editable}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="material_name" render={({ field }) => (
              <FormItem><FormLabel>Material Name *</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="material_code" render={({ field }) => (
              <FormItem><FormLabel>Material Code</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="ar_number" render={({ field }) => (
              <FormItem><FormLabel>AR Number *</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="material_mfg_date" render={({ field }) => (
              <FormItem><FormLabel>Material Mfg. Date</FormLabel><FormControl><Input type="month" {...field} value={(field.value || '').slice(0, 7)} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="material_exp_date" render={({ field }) => (
              <FormItem><FormLabel>Material Exp. Date</FormLabel><FormControl><Input type="month" {...field} value={(field.value || '').slice(0, 7)} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="vendor_name" render={({ field }) => (
              <FormItem><FormLabel>Vendor Name</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="required_quantity" render={({ field }) => (
              <FormItem><FormLabel>Required Qty *</FormLabel><FormControl><Input type="number" step="0.01" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="dispensed_quantity" render={({ field }) => (
              <FormItem><FormLabel>Dispensed Qty</FormLabel><FormControl><Input type="number" step="0.01" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="unit" render={({ field }) => (
              <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="checked_by_name" render={({ field }) => (
              <FormItem><FormLabel>Checked By</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="qa_verified_by_name" render={({ field }) => (
              <FormItem><FormLabel>QA Verified By</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="verified" render={({ field }) => (
            <FormItem className="flex items-center gap-2"><FormLabel>Verified Complete</FormLabel>
              <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!editable} /></FormItem>
          )} />
          <FormField control={form.control} name="remarks" render={({ field }) => (
            <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} disabled={!editable} /></FormControl></FormItem>
          )} />
          {editable && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Dispensing</Button>}
        </form></Form>
      </CardContent></Card>
  );
}

export function ManufacturingStepForm({ ebmr, onSuccess }: { ebmr: EbmrRecord; onSuccess: () => void }) {
  const actor = useEbmrActor();
  const editable = isEbmrEditable(ebmr) && canExecuteManufacturing(actor.role);
  const form = useForm<ManufacturingStepInput>({
    resolver: zodResolver(manufacturingStepSchema),
    defaultValues: {
      ebmr_doc_id: ebmr.id, step_number: 1, process_stage: 'Dispensing', instruction: '',
      start_datetime: nowLocal(), end_datetime: '', observed_value: '', acceptance_criteria: '',
      status: 'Completed', checked_by_name: '', remarks: '',
    },
  });

  return (
    <Card><CardHeader><CardTitle className="text-base">Manufacturing Step</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}><form onSubmit={form.handleSubmit(async (d) => {
          try {
            await saveManufacturingStep(d, actor);
            toast.success('Step recorded');
            onSuccess();
          } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
        })} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField control={form.control} name="step_number" render={({ field }) => (
              <FormItem><FormLabel>Step No *</FormLabel><FormControl><Input type="number" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="process_stage" render={({ field }) => (
              <FormItem><FormLabel>Process Stage</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!editable}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{PROCESS_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="start_datetime" render={({ field }) => (
              <FormItem><FormLabel>Start</FormLabel><FormControl><Input type="datetime-local" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="end_datetime" render={({ field }) => (
              <FormItem><FormLabel>End</FormLabel><FormControl><Input type="datetime-local" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="observed_value" render={({ field }) => (
              <FormItem><FormLabel>Observed Value</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="acceptance_criteria" render={({ field }) => (
              <FormItem><FormLabel>Acceptance Criteria</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem><FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!editable}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{STEP_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="checked_by_name" render={({ field }) => (
              <FormItem><FormLabel>Checked By</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="instruction" render={({ field }) => (
            <FormItem><FormLabel>Instruction</FormLabel><FormControl><Textarea {...field} disabled={!editable} /></FormControl></FormItem>
          )} />
          <FormField control={form.control} name="remarks" render={({ field }) => (
            <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} disabled={!editable} /></FormControl></FormItem>
          )} />
          {editable && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Step</Button>}
        </form></Form>
      </CardContent></Card>
  );
}

export function EquipmentUsageForm({ ebmr, onSuccess }: { ebmr: EbmrRecord; onSuccess: () => void }) {
  const actor = useEbmrActor();
  const editable = isEbmrEditable(ebmr);
  const [equipment, setEquipment] = useState<EquipmentRecord[]>([]);
  useEffect(() => { listSelectableEquipment().then(setEquipment); }, []);

  const form = useForm<EquipmentUsageInput>({
    resolver: zodResolver(equipmentUsageSchema),
    defaultValues: {
      ebmr_doc_id: ebmr.id, equipment_doc_id: '', equipment_id: '', equipment_name: '',
      process_stage: '', cleaning_status: 'Compliant', sterilization_status: 'Compliant',
      qualification_status: 'Compliant', calibration_status: 'Calibrated',
      usage_start_time: nowLocal(), usage_end_time: '', remarks: '',
    },
  });

  const pickEquipment = (docId: string) => {
    const eq = equipment.find((e) => e.id === docId);
    if (eq) {
      form.setValue('equipment_doc_id', eq.id);
      form.setValue('equipment_id', eq.equipment_id);
      form.setValue('equipment_name', eq.equipment_name);
    }
  };

  return (
    <Card><CardHeader><CardTitle className="text-base">Equipment Usage</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}><form onSubmit={form.handleSubmit(async (d) => {
          try {
            await saveEquipmentUsage(d, actor);
            toast.success('Equipment usage saved');
            onSuccess();
          } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
        })} className="space-y-3">
          <FormItem><FormLabel>Equipment (Qualified & Calibrated)</FormLabel>
            <Select onValueChange={pickEquipment} disabled={!editable}>
              <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
              <SelectContent>{equipment.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.equipment_id} — {e.equipment_name}</SelectItem>
              ))}</SelectContent>
            </Select></FormItem>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField control={form.control} name="process_stage" render={({ field }) => (
              <FormItem><FormLabel>Process Stage</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            {(['cleaning_status', 'sterilization_status', 'qualification_status'] as const).map((name) => (
              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                <FormItem><FormLabel className="capitalize">{name.replace(/_/g, ' ')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!editable}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{COMPLIANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></FormItem>
              )} />
            ))}
            <FormField control={form.control} name="calibration_status" render={({ field }) => (
              <FormItem><FormLabel>Calibration Status</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="usage_start_time" render={({ field }) => (
              <FormItem><FormLabel>Usage Start</FormLabel><FormControl><Input type="datetime-local" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="usage_end_time" render={({ field }) => (
              <FormItem><FormLabel>Usage End</FormLabel><FormControl><Input type="datetime-local" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="remarks" render={({ field }) => (
            <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} disabled={!editable} /></FormControl></FormItem>
          )} />
          {editable && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Equipment Usage</Button>}
        </form></Form>
      </CardContent></Card>
  );
}

export function CppRecordForm({ ebmr, onSuccess }: { ebmr: EbmrRecord; onSuccess: () => void }) {
  const actor = useEbmrActor();
  const editable = isEbmrEditable(ebmr);
  const ondansetron = isOndansetronProduct(ebmr.product_name);
  const cppParams = ondansetron ? getAllBmrCppParameters() : [];
  const form = useForm<CppRecordInput>({
    resolver: zodResolver(cppRecordSchema),
    defaultValues: {
      ebmr_doc_id: ebmr.id, process_stage: 'Mixing', parameter_name: '', target: 0,
      lsl: 0, usl: 0, observed_value: 0, unit: '', recorded_time: nowLocal(), remarks: '',
    },
  });

  const applyCppPreset = (paramName: string) => {
    const defaults = getCppDefaults(paramName);
    form.setValue('parameter_name', paramName);
    if (defaults) {
      form.setValue('target', defaults.target);
      form.setValue('lsl', defaults.lsl);
      form.setValue('usl', defaults.usl);
      form.setValue('unit', defaults.unit);
    }
  };

  return (
    <Card><CardHeader><CardTitle className="text-base">CPP Recording</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}><form onSubmit={form.handleSubmit(async (d) => {
          try {
            await saveCppRecord(d, actor);
            toast.success('CPP recorded');
            onSuccess();
          } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
        })} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField control={form.control} name="process_stage" render={({ field }) => (
              <FormItem><FormLabel>Process Stage</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!editable}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{PROCESS_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="parameter_name" render={({ field }) => (
              <FormItem><FormLabel>Parameter *</FormLabel>
                {ondansetron && cppParams.length > 0 ? (
                  <Select onValueChange={(v) => { field.onChange(v); applyCppPreset(v); }} value={field.value} disabled={!editable}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select parameter" /></SelectTrigger></FormControl>
                    <SelectContent>{cppParams.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <FormControl><Input {...field} disabled={!editable} /></FormControl>
                )}
              </FormItem>
            )} />
            <FormField control={form.control} name="target" render={({ field }) => (
              <FormItem><FormLabel>Target</FormLabel><FormControl><Input type="number" step="0.01" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="lsl" render={({ field }) => (
              <FormItem><FormLabel>LSL</FormLabel><FormControl><Input type="number" step="0.01" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="usl" render={({ field }) => (
              <FormItem><FormLabel>USL</FormLabel><FormControl><Input type="number" step="0.01" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="observed_value" render={({ field }) => (
              <FormItem><FormLabel>Observed *</FormLabel><FormControl><Input type="number" step="0.01" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="unit" render={({ field }) => (
              <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="recorded_time" render={({ field }) => (
              <FormItem><FormLabel>Recorded Time</FormLabel><FormControl><Input type="datetime-local" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="remarks" render={({ field }) => (
            <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} disabled={!editable} /></FormControl></FormItem>
          )} />
          {editable && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save CPP</Button>}
        </form></Form>
      </CardContent></Card>
  );
}

export function IpcCheckForm({ ebmr, onSuccess }: { ebmr: EbmrRecord; onSuccess: () => void }) {
  const actor = useEbmrActor();
  const editable = isEbmrEditable(ebmr) && canEnterIpc(actor.role);
  const ondansetron = isOndansetronProduct(ebmr.product_name);
  const ipcOptions = ondansetron
    ? Array.from(new Set([...IPC_CHECK_NAMES, ...getAllBmrIpcParameters()]))
    : [...IPC_CHECK_NAMES];
  const form = useForm<IpcCheckInput>({
    resolver: zodResolver(ipcCheckSchema),
    defaultValues: {
      ebmr_doc_id: ebmr.id, check_name: 'pH', frequency: '', specification: '',
      observed_result: '', unit: '', check_datetime: nowLocal(), remarks: '',
    },
  });

  const applyIpcPreset = (checkName: string) => {
    form.setValue('check_name', checkName as IpcCheckInput['check_name']);
    const spec = getIpcSpecification(checkName);
    if (spec) form.setValue('specification', spec);
  };

  return (
    <Card><CardHeader><CardTitle className="text-base">IPC Check</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}><form onSubmit={form.handleSubmit(async (d) => {
          try {
            await saveIpcCheck(d, actor);
            toast.success('IPC check saved');
            onSuccess();
          } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
        })} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField control={form.control} name="check_name" render={({ field }) => (
              <FormItem><FormLabel>Check Name</FormLabel>
                <Select onValueChange={(v) => { field.onChange(v); applyIpcPreset(v); }} value={field.value} disabled={!editable}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{ipcOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></FormItem>
            )} />
            <FormField control={form.control} name="frequency" render={({ field }) => (
              <FormItem><FormLabel>Frequency</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="specification" render={({ field }) => (
              <FormItem><FormLabel>Specification</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="observed_result" render={({ field }) => (
              <FormItem><FormLabel>Observed Result *</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="unit" render={({ field }) => (
              <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="check_datetime" render={({ field }) => (
              <FormItem><FormLabel>Date Time</FormLabel><FormControl><Input type="datetime-local" {...field} disabled={!editable} /></FormControl></FormItem>
            )} />
          </div>
          <FormField control={form.control} name="remarks" render={({ field }) => (
            <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} disabled={!editable} /></FormControl></FormItem>
          )} />
          {editable && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save IPC Check</Button>}
        </form></Form>
      </CardContent></Card>
  );
}

export function EbmrReviewForm({ ebmr, onSuccess }: { ebmr: EbmrRecord; onSuccess: () => void }) {
  const actor = useEbmrActor();
  const editable = isEbmrEditable(ebmr) && canVerifyLineClearance(actor.role);
  const form = useForm<EbmrReviewInput>({
    resolver: zodResolver(ebmrReviewSchema),
    defaultValues: { ebmr_doc_id: ebmr.id, review_type: 'QA Review', decision: 'Approved', comments: '' },
  });

  return (
    <Card><CardHeader><CardTitle className="text-base">Batch Review</CardTitle></CardHeader>
      <CardContent>
        <Form {...form}><form onSubmit={form.handleSubmit(async (d) => {
          try {
            await saveEbmrReview(d, actor);
            toast.success('Review submitted');
            onSuccess();
          } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
        })} className="space-y-3">
          <FormField control={form.control} name="decision" render={({ field }) => (
            <FormItem><FormLabel>Decision</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!editable}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Hold">Hold</SelectItem>
                </SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="comments" render={({ field }) => (
            <FormItem><FormLabel>Comments</FormLabel><FormControl><Textarea {...field} disabled={!editable} /></FormControl></FormItem>
          )} />
          {editable && <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Submit Review</Button>}
        </form></Form>
      </CardContent></Card>
  );
}

export function EbmrReleaseForm({ ebmr, onSuccess }: { ebmr: EbmrRecord; onSuccess: () => void }) {
  const actor = useEbmrActor();
  const canRelease = canReleaseBatch(actor.role) && ebmr.batch_status === 'Approved' && !ebmr.is_locked;
  const form = useForm<EbmrReleaseInput>({
    resolver: zodResolver(ebmrReleaseSchema),
    defaultValues: { ebmr_doc_id: ebmr.id, decision: 'Released', remarks: '' },
  });

  return (
    <Card><CardHeader><CardTitle className="text-base">Batch Release</CardTitle></CardHeader>
      <CardContent>
        {ebmr.batch_status !== 'Approved' && !ebmr.is_locked && (
          <p className="text-sm text-amber-600 mb-3">Batch must be QA Approved before release.</p>
        )}
        {ebmr.is_locked && <p className="text-sm text-green-600 mb-3">This batch has been released and is locked.</p>}
        <Form {...form}><form onSubmit={form.handleSubmit(async (d) => {
          try {
            await releaseEbmr(d, actor);
            toast.success('Batch release recorded');
            onSuccess();
          } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
        })} className="space-y-3">
          <FormField control={form.control} name="decision" render={({ field }) => (
            <FormItem><FormLabel>Decision</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!canRelease}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="Released">Released</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select></FormItem>
          )} />
          <FormField control={form.control} name="remarks" render={({ field }) => (
            <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} disabled={!canRelease} /></FormControl></FormItem>
          )} />
          {canRelease && <Button type="submit" className="bg-green-600 hover:bg-green-700">Release Batch</Button>}
        </form></Form>
      </CardContent></Card>
  );
}
