'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  PQR_AVL_STATUSES, PQR_MATERIAL_TYPES, PQR_QC_STATUSES, PQR_RISK_LEVELS,
  materialReviewFormSchema, type MaterialReviewFormData, type PqrMaterialReviewRecord,
} from '@/lib/pqr-material-review-records';
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

export function MaterialReviewFormDialog({
  open, onOpenChange, pqr, record, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pqr: PqrOption;
  record?: PqrMaterialReviewRecord | null;
  onSubmit: (data: MaterialReviewFormData) => Promise<void>;
  loading?: boolean;
}) {
  const form = useForm<MaterialReviewFormData>({
    resolver: zodResolver(materialReviewFormSchema),
    defaultValues: {
      pqrId: pqr.id, product: pqr.productName, productCode: pqr.productCode,
      batchNumber: '', materialType: 'API', materialName: '', materialCode: '', materialGrade: 'IP',
      manufacturerName: '', supplierName: '', vendorAvlStatus: 'Not Approved',
      grnNumber: '', arNumber: '', coaNumber: '', materialLotNumber: '',
      mfgDate: '', expDate: '', retestDate: '', receivedQuantity: 0, issuedQuantity: 0,
      usedQuantity: 1, unit: 'Kg', qcStatus: 'Approved', coaAvailable: 'Yes',
      specificationNumber: '', stpNumber: '', riskLevel: 'Low', remarks: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(record ? {
      pqrId: pqr.id, product: record.product, productCode: record.productCode,
      batchNumber: record.batchNumber, materialType: record.materialType as MaterialReviewFormData['materialType'],
      materialName: record.materialName, materialCode: record.materialCode, materialGrade: record.materialGrade,
      manufacturerName: record.manufacturerName, supplierName: record.supplierName,
      vendorAvlStatus: record.vendorAvlStatus as MaterialReviewFormData['vendorAvlStatus'],
      grnNumber: record.grnNumber, arNumber: record.arNumber, coaNumber: record.coaNumber,
      materialLotNumber: record.materialLotNumber, mfgDate: record.mfgDate, expDate: record.expDate,
      retestDate: record.retestDate, receivedQuantity: record.receivedQuantity,
      issuedQuantity: record.issuedQuantity, usedQuantity: record.usedQuantity, unit: record.unit,
      qcStatus: record.qcStatus as MaterialReviewFormData['qcStatus'],
      coaAvailable: record.coaAvailable, specificationNumber: record.specificationNumber,
      stpNumber: record.stpNumber, riskLevel: record.riskLevel as MaterialReviewFormData['riskLevel'],
      remarks: record.remarks,
    } : {
      pqrId: pqr.id, product: pqr.productName, productCode: pqr.productCode,
      batchNumber: '', materialType: 'API', materialName: '', materialCode: '', materialGrade: 'IP',
      manufacturerName: '', supplierName: '', vendorAvlStatus: 'Not Approved',
      grnNumber: '', arNumber: '', coaNumber: '', materialLotNumber: '',
      mfgDate: '', expDate: '', retestDate: '', receivedQuantity: 0, issuedQuantity: 0,
      usedQuantity: 1, unit: 'Kg', qcStatus: 'Approved', coaAvailable: 'Yes',
      specificationNumber: '', stpNumber: '', riskLevel: 'Low', remarks: '',
    });
  }, [open, record, pqr, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? 'Edit Material Review' : 'Add Material Review'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="materialName" render={({ field }) => (
                <FormItem><FormLabel>Material Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="materialType" render={({ field }) => (
                <FormItem><FormLabel>Material Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{PQR_MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="manufacturerName" render={({ field }) => (
                <FormItem><FormLabel>Manufacturer *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="supplierName" render={({ field }) => (
                <FormItem><FormLabel>Supplier *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="arNumber" render={({ field }) => (
                <FormItem><FormLabel>AR Number *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="batchNumber" render={({ field }) => (
                <FormItem><FormLabel>Batch Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="usedQuantity" render={({ field }) => (
                <FormItem><FormLabel>Used Quantity *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="issuedQuantity" render={({ field }) => (
                <FormItem><FormLabel>Issued Quantity</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="unit" render={({ field }) => (
                <FormItem><FormLabel>Unit *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="qcStatus" render={({ field }) => (
                <FormItem><FormLabel>QC Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{PQR_QC_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="coaAvailable" render={({ field }) => (
                <FormItem><FormLabel>COA Available *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="vendorAvlStatus" render={({ field }) => (
                <FormItem><FormLabel>AVL Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{PQR_AVL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="mfgDate" render={({ field }) => (
                <FormItem><FormLabel>MFG Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="expDate" render={({ field }) => (
                <FormItem><FormLabel>EXP Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="retestDate" render={({ field }) => (
                <FormItem><FormLabel>Retest Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="riskLevel" render={({ field }) => (
                <FormItem><FormLabel>Risk Level</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{PQR_RISK_LEVELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
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
