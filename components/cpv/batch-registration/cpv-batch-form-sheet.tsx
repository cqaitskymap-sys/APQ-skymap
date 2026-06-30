'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  cpvBatchFormSchema,
  CPV_BATCH_STATUSES,
  CPV_RELEASE_STATUSES,
  isBatchFieldLocked,
  toMonthYearValue,
  type CpvBatchFormData,
  type CpvBatchRecord,
} from '@/lib/cpv-batch-registration';
import { cpvProductToBatchAutofill } from '@/lib/cpv-batch-registration-service';
import type { CpvProductRecord } from '@/lib/cpv-product-master';
import { CPV_REVIEW_FREQUENCIES } from '@/lib/cpv-product-master';

interface CpvBatchFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: CpvBatchRecord | null;
  cpvProducts: CpvProductRecord[];
  onSubmit: (data: CpvBatchFormData) => Promise<void>;
  submitting?: boolean;
}

export function CpvBatchFormSheet({
  open,
  onOpenChange,
  editing,
  cpvProducts,
  onSubmit,
  submitting,
}: CpvBatchFormSheetProps) {
  const locked = editing ? isBatchFieldLocked(editing.batchStatus) : false;

  const form = useForm<CpvBatchFormData>({
    resolver: zodResolver(cpvBatchFormSchema),
    defaultValues: {
      cpvProductId: '',
      batchNumber: '',
      productCode: '',
      productName: '',
      genericName: '',
      strength: '',
      dosageForm: '',
      packSize: '',
      market: '',
      batchSize: 1,
      batchSizeUnit: 'Vials',
      manufacturingDate: new Date().toISOString().slice(0, 7),
      expiryDate: '',
      manufacturingSite: '',
      manufacturingLine: '',
      shift: 'A',
      mfrNumber: '',
      bmrNumber: '',
      bprNumber: '',
      semiFinishedBatchNumber: '',
      finishedProductBatchNumber: '',
      packingBatchNumber: '',
      manufacturedFor: '',
      customerName: '',
      cpvReviewPeriod: 'Yearly',
      batchStatus: 'Planned',
      releaseStatus: 'Pending',
      qaReleaseDate: '',
      qaReleasedBy: '',
      statusChangeReason: '',
      remarks: '',
    },
  });

  const batchStatus = form.watch('batchStatus');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        cpvProductId: editing.cpvProductId,
        batchNumber: editing.batchNumber,
        productCode: editing.productCode,
        productName: editing.productName,
        genericName: editing.genericName,
        strength: editing.strength,
        dosageForm: editing.dosageForm,
        packSize: editing.packSize,
        market: editing.market,
        batchSize: editing.batchSize,
        batchSizeUnit: editing.batchSizeUnit,
        manufacturingDate: toMonthYearValue(editing.manufacturingDate),
        expiryDate: toMonthYearValue(editing.expiryDate),
        manufacturingSite: editing.manufacturingSite,
        manufacturingLine: editing.manufacturingLine,
        shift: editing.shift,
        mfrNumber: editing.mfrNumber,
        bmrNumber: editing.bmrNumber,
        bprNumber: editing.bprNumber,
        semiFinishedBatchNumber: editing.semiFinishedBatchNumber,
        finishedProductBatchNumber: editing.finishedProductBatchNumber,
        packingBatchNumber: editing.packingBatchNumber,
        manufacturedFor: editing.manufacturedFor,
        customerName: editing.customerName,
        cpvReviewPeriod: editing.cpvReviewPeriod,
        batchStatus: editing.batchStatus,
        releaseStatus: editing.releaseStatus,
        qaReleaseDate: editing.qaReleaseDate,
        qaReleasedBy: editing.qaReleasedBy,
        statusChangeReason: editing.statusChangeReason,
        remarks: editing.remarks,
      });
    }
  }, [open, editing, form]);

  const handleProductSelect = (productId: string) => {
    const product = cpvProducts.find((p) => p.id === productId);
    if (!product) return;
    const fill = cpvProductToBatchAutofill(product);
    form.setValue('cpvProductId', productId);
    Object.entries(fill).forEach(([key, val]) => {
      if (val !== undefined) form.setValue(key as keyof CpvBatchFormData, val as never);
    });
  };

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? 'Edit CPV Batch' : 'Register CPV Batch'}</SheetTitle>
          <SheetDescription>Register manufacturing batch under Continued Process Verification.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <FormField
              control={form.control}
              name="cpvProductId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPV Product *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => handleProductSelect(v)}
                    disabled={locked}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select CPV product" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cpvProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.productCode} — {p.productName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('productName') && (
              <Card className="border-blue-100 bg-blue-50/50">
                <CardContent className="p-3 text-xs text-slate-700">
                  <strong>Auto-filled:</strong> {form.watch('productCode')} · {form.watch('productName')} · {form.watch('strength')} · {form.watch('dosageForm')}
                </CardContent>
              </Card>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField control={form.control} name="batchNumber" render={({ field }) => (
                <FormItem><FormLabel>Batch Number *</FormLabel><FormControl><Input {...field} readOnly={locked} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="batchSize" render={({ field }) => (
                <FormItem><FormLabel>Batch Size *</FormLabel><FormControl><Input type="number" {...field} readOnly={locked} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="manufacturingDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mfg Date *</FormLabel>
                  <FormControl>
                    <Input
                      type="month"
                      value={toMonthYearValue(field.value)}
                      onChange={(e) => field.onChange(e.target.value)}
                      readOnly={locked}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="expiryDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry Date *</FormLabel>
                  <FormControl>
                    <Input
                      type="month"
                      value={toMonthYearValue(field.value)}
                      onChange={(e) => field.onChange(e.target.value)}
                      readOnly={locked}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="manufacturingSite" render={({ field }) => (
                <FormItem><FormLabel>Manufacturing Site *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="manufacturingLine" render={({ field }) => (
                <FormItem><FormLabel>Manufacturing Line</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="shift" render={({ field }) => (
                <FormItem><FormLabel>Shift</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="mfrNumber" render={({ field }) => (
                <FormItem><FormLabel>MFR Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="bmrNumber" render={({ field }) => (
                <FormItem><FormLabel>BMR Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="bprNumber" render={({ field }) => (
                <FormItem><FormLabel>BPR Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="semiFinishedBatchNumber" render={({ field }) => (
                <FormItem><FormLabel>Semi Finished Batch</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="finishedProductBatchNumber" render={({ field }) => (
                <FormItem><FormLabel>Finished Product Batch</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="packingBatchNumber" render={({ field }) => (
                <FormItem><FormLabel>Packing Batch</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="manufacturedFor" render={({ field }) => (
                <FormItem><FormLabel>Manufactured For</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem><FormLabel>Customer Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="cpvReviewPeriod" render={({ field }) => (
                <FormItem>
                  <FormLabel>CPV Review Period</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{CPV_REVIEW_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="batchStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{CPV_BATCH_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="releaseStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel>Release Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{CPV_RELEASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            {(batchStatus === 'Rejected' || batchStatus === 'Hold') && (
              <FormField control={form.control} name="statusChangeReason" render={({ field }) => (
                <FormItem>
                  <FormLabel>{batchStatus === 'Rejected' ? 'Rejection Reason *' : 'Hold Reason *'}</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
            )} />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : editing ? 'Update' : 'Register'}</Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
