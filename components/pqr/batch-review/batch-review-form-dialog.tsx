'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  BATCH_RELEASE_STATUSES, BATCH_REVIEW_STATUSES, batchReviewFormSchema,
  type BatchReviewFormData, type PqrBatchReviewRecord, type PqrOption,
} from '@/lib/pqr-batch-review-records';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export function BatchReviewFormDialog({
  open,
  onOpenChange,
  pqr,
  record,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pqr: PqrOption;
  record?: PqrBatchReviewRecord | null;
  onSubmit: (data: BatchReviewFormData) => Promise<void>;
  loading?: boolean;
}) {
  const form = useForm<BatchReviewFormData>({
    resolver: zodResolver(batchReviewFormSchema),
    defaultValues: {
      pqrId: pqr.id,
      product: pqr.productName,
      productCode: pqr.productCode,
      genericName: pqr.genericName,
      strength: pqr.strength,
      dosageForm: pqr.dosageForm,
      batchNumber: '',
      semiFinishedBatchNumber: '',
      finishedProductBatchNumber: '',
      packingBatchNumber: '',
      manufacturingDate: '',
      expiryDate: '',
      batchSize: 1,
      batchSizeUnit: 'Vials',
      manufacturedFor: '',
      customerName: '',
      market: '',
      batchStatus: 'Manufactured',
      releaseStatus: 'Pending',
      releaseDate: '',
      qaReleasedBy: '',
      rejectionReason: '',
      holdReason: '',
      reworkRequired: false,
      reprocessRequired: false,
      remarks: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(record ? {
        pqrId: pqr.id,
        product: record.product,
        productCode: record.productCode,
        genericName: record.genericName,
        strength: record.strength,
        dosageForm: record.dosageForm,
        batchNumber: record.batchNumber,
        semiFinishedBatchNumber: record.semiFinishedBatchNumber,
        finishedProductBatchNumber: record.finishedProductBatchNumber,
        packingBatchNumber: record.packingBatchNumber,
        manufacturingDate: record.manufacturingDate,
        expiryDate: record.expiryDate,
        batchSize: record.batchSize,
        batchSizeUnit: record.batchSizeUnit,
        manufacturedFor: record.manufacturedFor,
        customerName: record.customerName,
        market: record.market,
        batchStatus: record.batchStatus as BatchReviewFormData['batchStatus'],
        releaseStatus: record.releaseStatus as BatchReviewFormData['releaseStatus'],
        releaseDate: record.releaseDate,
        qaReleasedBy: record.qaReleasedBy,
        rejectionReason: record.rejectionReason,
        holdReason: record.holdReason,
        reworkRequired: record.reworkRequired,
        reprocessRequired: record.reprocessRequired,
        remarks: record.remarks,
      } : {
        pqrId: pqr.id,
        product: pqr.productName,
        productCode: pqr.productCode,
        genericName: pqr.genericName,
        strength: pqr.strength,
        dosageForm: pqr.dosageForm,
        batchNumber: '',
        semiFinishedBatchNumber: '',
        finishedProductBatchNumber: '',
        packingBatchNumber: '',
        manufacturingDate: '',
        expiryDate: '',
        batchSize: 1,
        batchSizeUnit: 'Vials',
        manufacturedFor: '',
        customerName: '',
        market: '',
        batchStatus: 'Manufactured',
        releaseStatus: 'Pending',
        releaseDate: '',
        qaReleasedBy: '',
        rejectionReason: '',
        holdReason: '',
        reworkRequired: false,
        reprocessRequired: false,
        remarks: '',
      });
    }
  }, [open, record, pqr, form]);

  const batchStatus = form.watch('batchStatus');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? 'Edit Batch Review' : 'Add Batch Review'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="batchNumber" render={({ field }) => (
                <FormItem><FormLabel>Batch Number *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="batchSize" render={({ field }) => (
                <FormItem><FormLabel>Batch Size *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="manufacturingDate" render={({ field }) => (
                <FormItem><FormLabel>MFG Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="expiryDate" render={({ field }) => (
                <FormItem><FormLabel>EXP Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="semiFinishedBatchNumber" render={({ field }) => (
                <FormItem><FormLabel>Semi Finish Batch No.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="finishedProductBatchNumber" render={({ field }) => (
                <FormItem><FormLabel>Finished Product Batch No.</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="manufacturedFor" render={({ field }) => (
                <FormItem><FormLabel>Manufactured For</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem><FormLabel>Customer Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="batchStatus" render={({ field }) => (
                <FormItem><FormLabel>Batch Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{BATCH_REVIEW_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="releaseStatus" render={({ field }) => (
                <FormItem><FormLabel>Release Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{BATCH_RELEASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            {batchStatus === 'Rejected' && (
              <FormField control={form.control} name="rejectionReason" render={({ field }) => (
                <FormItem><FormLabel>Rejection Reason *</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            {batchStatus === 'Hold' && (
              <FormField control={form.control} name="holdReason" render={({ field }) => (
                <FormItem><FormLabel>Hold Reason *</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            <div className="flex gap-6">
              <FormField control={form.control} name="reworkRequired" render={({ field }) => (
                <FormItem className="flex items-center gap-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Rework Required</FormLabel></FormItem>
              )} />
              <FormField control={form.control} name="reprocessRequired" render={({ field }) => (
                <FormItem className="flex items-center gap-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">Reprocess Required</FormLabel></FormItem>
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
