'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  PQR_EQUIPMENT_CATEGORIES, PQR_EQUIPMENT_TYPES,
  PQR_QUALIFICATION_STATUSES,
  equipmentReviewFormSchema, type EquipmentReviewFormData, type PqrEquipmentReviewRecord,
} from '@/lib/pqr-equipment-review-records';
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const defaults = (pqr: PqrOption): EquipmentReviewFormData => ({
  pqrId: pqr.id, product: pqr.productName, productCode: pqr.productCode,
  equipmentId: '', equipmentCode: '', equipmentName: '',
  equipmentCategory: 'Manufacturing Equipment', equipmentType: 'Other',
  department: '', area: '', modelNumber: '', serialNumber: '', manufacturer: '',
  installationDate: '', qualificationStatus: 'Qualified',
  iqStatus: '', oqStatus: '', pqStatus: '',
  calibrationStatus: 'Calibrated', lastCalibrationDate: '', nextCalibrationDate: '',
  pmStatus: 'Completed', lastPmDate: '', nextPmDate: '',
  breakdownCount: 0, downtimeHours: 0, linkedDeviations: 0, linkedCapa: 0, linkedChangeControls: 0,
  impactOnProduct: 'None', riskLevel: 'Low', remarks: '',
});

export function EquipmentReviewFormDialog({
  open, onOpenChange, pqr, record, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pqr: PqrOption;
  record?: PqrEquipmentReviewRecord | null;
  onSubmit: (data: EquipmentReviewFormData) => Promise<void>;
  loading?: boolean;
}) {
  const form = useForm<EquipmentReviewFormData>({
    resolver: zodResolver(equipmentReviewFormSchema),
    defaultValues: defaults(pqr),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(record ? {
      pqrId: pqr.id, product: record.product, productCode: record.productCode,
      equipmentId: record.equipmentId, equipmentCode: record.equipmentCode,
      equipmentName: record.equipmentName,
      equipmentCategory: record.equipmentCategory as EquipmentReviewFormData['equipmentCategory'],
      equipmentType: record.equipmentType as EquipmentReviewFormData['equipmentType'],
      department: record.department, area: record.area,
      modelNumber: record.modelNumber, serialNumber: record.serialNumber,
      manufacturer: record.manufacturer, installationDate: record.installationDate,
      qualificationStatus: record.qualificationStatus as EquipmentReviewFormData['qualificationStatus'],
      iqStatus: record.iqStatus, oqStatus: record.oqStatus, pqStatus: record.pqStatus,
      calibrationStatus: record.calibrationStatus as EquipmentReviewFormData['calibrationStatus'],
      lastCalibrationDate: record.lastCalibrationDate, nextCalibrationDate: record.nextCalibrationDate,
      pmStatus: record.pmStatus as EquipmentReviewFormData['pmStatus'],
      lastPmDate: record.lastPmDate, nextPmDate: record.nextPmDate,
      breakdownCount: record.breakdownCount, downtimeHours: record.downtimeHours,
      linkedDeviations: record.linkedDeviations, linkedCapa: record.linkedCapa,
      linkedChangeControls: record.linkedChangeControls, impactOnProduct: record.impactOnProduct,
      riskLevel: record.riskLevel as EquipmentReviewFormData['riskLevel'], remarks: record.remarks,
    } : defaults(pqr));
  }, [open, record, pqr, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? 'Edit Equipment Review' : 'Add Equipment Review'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="equipmentName" render={({ field }) => (
                <FormItem><FormLabel>Equipment Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="equipmentId" render={({ field }) => (
                <FormItem><FormLabel>Equipment ID *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="equipmentCategory" render={({ field }) => (
                <FormItem><FormLabel>Category *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{PQR_EQUIPMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="equipmentType" render={({ field }) => (
                <FormItem><FormLabel>Equipment Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{PQR_EQUIPMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="qualificationStatus" render={({ field }) => (
                <FormItem><FormLabel>Qualification Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{PQR_QUALIFICATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="nextCalibrationDate" render={({ field }) => (
                <FormItem><FormLabel>Next Calibration</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lastPmDate" render={({ field }) => (
                <FormItem><FormLabel>Last PM Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
