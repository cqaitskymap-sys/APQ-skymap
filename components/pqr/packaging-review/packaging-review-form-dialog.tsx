'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  PQR_AVL_STATUSES, PQR_PACKAGING_CATEGORIES, PQR_PACKAGING_TYPES, PQR_QC_STATUSES, PQR_RISK_LEVELS,
  packagingReviewFormSchema, type PackagingReviewFormData, type PqrPackagingReviewRecord,
} from '@/lib/pqr-packaging-review-records';
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

const defaultValues = (pqr: PqrOption): PackagingReviewFormData => ({
  pqrId: pqr.id, product: pqr.productName, productCode: pqr.productCode,
  batchNumber: '', packagingMaterialType: 'Primary Packaging Material',
  packagingMaterialCategory: 'Glass Vial', materialName: '', materialCode: '',
  manufacturerName: '', supplierName: '', vendorAvlStatus: 'Not Approved',
  grnNumber: '', arNumber: '', coaNumber: '', materialLotNumber: '',
  mfgDate: '', expDate: '', receivedQuantity: 0, issuedQuantity: 1,
  usedQuantity: 0, rejectedQuantity: 0, returnedQuantity: 0,
  unit: 'Nos', qcStatus: 'Approved', coaAvailable: 'Yes',
  specificationNumber: '', stpNumber: '', riskLevel: 'Low', remarks: '',
});

export function PackagingReviewFormDialog({
  open, onOpenChange, pqr, record, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pqr: PqrOption;
  record?: PqrPackagingReviewRecord | null;
  onSubmit: (data: PackagingReviewFormData) => Promise<void>;
  loading?: boolean;
}) {
  const form = useForm<PackagingReviewFormData>({
    resolver: zodResolver(packagingReviewFormSchema),
    defaultValues: defaultValues(pqr),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(record ? {
      pqrId: pqr.id, product: record.product, productCode: record.productCode,
      batchNumber: record.batchNumber,
      packagingMaterialType: record.packagingMaterialType as PackagingReviewFormData['packagingMaterialType'],
      packagingMaterialCategory: record.packagingMaterialCategory as PackagingReviewFormData['packagingMaterialCategory'],
      materialName: record.materialName, materialCode: record.materialCode,
      manufacturerName: record.manufacturerName, supplierName: record.supplierName,
      vendorAvlStatus: record.vendorAvlStatus as PackagingReviewFormData['vendorAvlStatus'],
      grnNumber: record.grnNumber, arNumber: record.arNumber, coaNumber: record.coaNumber,
      materialLotNumber: record.materialLotNumber, mfgDate: record.mfgDate, expDate: record.expDate,
      receivedQuantity: record.receivedQuantity, issuedQuantity: record.issuedQuantity,
      usedQuantity: record.usedQuantity, rejectedQuantity: record.rejectedQuantity,
      returnedQuantity: record.returnedQuantity, unit: record.unit,
      qcStatus: record.qcStatus as PackagingReviewFormData['qcStatus'],
      coaAvailable: record.coaAvailable, specificationNumber: record.specificationNumber,
      stpNumber: record.stpNumber, riskLevel: record.riskLevel as PackagingReviewFormData['riskLevel'],
      remarks: record.remarks,
    } : defaultValues(pqr));
  }, [open, record, pqr, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? 'Edit Packaging Review' : 'Add Packaging Review'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="materialName" render={({ field }) => (
                <FormItem><FormLabel>Material Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="packagingMaterialType" render={({ field }) => (
                <FormItem><FormLabel>Packaging Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{PQR_PACKAGING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="packagingMaterialCategory" render={({ field }) => (
                <FormItem><FormLabel>Category *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{PQR_PACKAGING_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
              <FormField control={form.control} name="issuedQuantity" render={({ field }) => (
                <FormItem><FormLabel>Issued Quantity *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="usedQuantity" render={({ field }) => (
                <FormItem><FormLabel>Used Quantity *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="rejectedQuantity" render={({ field }) => (
                <FormItem><FormLabel>Rejected Quantity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="returnedQuantity" render={({ field }) => (
                <FormItem><FormLabel>Returned Quantity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
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
