'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CLEANROOM_GRADES } from '@/lib/cpv-environmental-monitoring';
import { UTILITY_TYPES } from '@/lib/cpv-utility-monitoring';
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import {
  PQR_REVIEW_TYPES, utilityEnvReviewFormSchema, type PqrUtilityEnvironmentalReviewRecord,
  type UtilityEnvReviewFormData,
} from '@/lib/pqr-utility-environmental-review-records';
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

const defaults = (pqr: PqrOption): UtilityEnvReviewFormData => ({
  pqrId: pqr.id, product: pqr.productName, productCode: pqr.productCode,
  reviewPeriodFrom: pqr.reviewPeriodFrom?.slice(0, 10) || '',
  reviewPeriodTo: pqr.reviewPeriodTo?.slice(0, 10) || '',
  reviewType: 'Utility Review', systemAreaName: '', systemAreaCode: '',
  utilityType: 'Other', cleanroomGrade: 'Unclassified', roomNumber: '',
  monitoringParameter: '', observedMinimum: null, observedMaximum: null, observedAverage: null,
  lowerLimit: 0, upperLimit: 100, alertCount: 0, actionCount: 0, excursionCount: 0,
  deviationCount: 0, capaCount: 0, changeControlCount: 0,
  impactOnProductQuality: 'No', conclusion: '', remarks: '',
});

export function UtilityEnvReviewFormDialog({
  open, onOpenChange, pqr, record, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pqr: PqrOption;
  record?: PqrUtilityEnvironmentalReviewRecord | null;
  onSubmit: (data: UtilityEnvReviewFormData) => Promise<void>;
  loading?: boolean;
}) {
  const form = useForm<UtilityEnvReviewFormData>({
    resolver: zodResolver(utilityEnvReviewFormSchema),
    defaultValues: defaults(pqr),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(record ? {
      pqrId: pqr.id, product: record.product, productCode: record.productCode,
      reviewPeriodFrom: record.reviewPeriodFrom, reviewPeriodTo: record.reviewPeriodTo,
      reviewType: record.reviewType as UtilityEnvReviewFormData['reviewType'],
      systemAreaName: record.systemAreaName, systemAreaCode: record.systemAreaCode,
      utilityType: record.utilityType as UtilityEnvReviewFormData['utilityType'],
      cleanroomGrade: record.cleanroomGrade as UtilityEnvReviewFormData['cleanroomGrade'],
      roomNumber: record.roomNumber, monitoringParameter: record.monitoringParameter,
      observedMinimum: record.observedMinimum, observedMaximum: record.observedMaximum,
      observedAverage: record.observedAverage, lowerLimit: record.lowerLimit, upperLimit: record.upperLimit,
      alertCount: record.alertCount, actionCount: record.actionCount, excursionCount: record.excursionCount,
      deviationCount: record.deviationCount, capaCount: record.capaCount,
      changeControlCount: record.changeControlCount, impactOnProductQuality: record.impactOnProductQuality,
      conclusion: record.conclusion, remarks: record.remarks,
    } : defaults(pqr));
  }, [open, record, pqr, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? 'Edit Review Record' : 'Add Review Record'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="reviewType" render={({ field }) => (
                <FormItem><FormLabel>Review Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{PQR_REVIEW_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="systemAreaName" render={({ field }) => (
                <FormItem><FormLabel>System / Area Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="monitoringParameter" render={({ field }) => (
                <FormItem><FormLabel>Parameter *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="utilityType" render={({ field }) => (
                <FormItem><FormLabel>Utility Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{UTILITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="cleanroomGrade" render={({ field }) => (
                <FormItem><FormLabel>Cleanroom Grade</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{CLEANROOM_GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="lowerLimit" render={({ field }) => (
                <FormItem><FormLabel>Lower Limit *</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="upperLimit" render={({ field }) => (
                <FormItem><FormLabel>Upper Limit *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="excursionCount" render={({ field }) => (
                <FormItem><FormLabel>Excursion Count</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="alertCount" render={({ field }) => (
                <FormItem><FormLabel>Alert Count</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
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
