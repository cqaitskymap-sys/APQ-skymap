'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { ReceiptPicker, InventoryPicker, VendorPicker } from './warehouse-filters';
import { useWarehouseActor } from '@/hooks/use-warehouse-mgmt';
import {
  receiptSchema, samplingSchema, releaseSchema, dispensingSchema, finishedGoodsSchema,
  type ReceiptInput, type SamplingInput, type ReleaseInput, type DispensingInput, type FinishedGoodsInput,
} from '@/lib/warehouse-mgmt-schemas';
import { WAREHOUSE_MATERIAL_TYPES, QC_STATUSES, STORAGE_CONDITIONS } from '@/lib/warehouse-mgmt-types';
import {
  createReceipt, createSampling, createRelease, createDispensing, createFinishedGoods, suggestFifoLots,
} from '@/lib/warehouse-mgmt-service';
import type { MaterialReceipt, InventoryStock } from '@/lib/warehouse-mgmt-types';
import type { VendorRecord } from '@/lib/vendor-mgmt-types';
import { listSelectableVendors } from '@/lib/vendor-mgmt-service';

export function ReceiptForm({ onSuccess }: { onSuccess: () => void; onClose: () => void }) {
  const actor = useWarehouseActor();
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  useEffect(() => { listSelectableVendors().then(setVendors); }, []);

  const form = useForm<ReceiptInput>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      receipt_date: new Date().toISOString().split('T')[0], material_type: 'API',
      material_code: '', material_name: '', vendor_doc_id: null, vendor_name: '',
      manufacturer_name: '', supplier_name: '', invoice_number: '', po_number: '',
      batch_lot_number: '', received_quantity: 0, unit: 'kg', container_count: 1,
      storage_condition: 'Room Temperature (15-25°C)', coa_available: false, remarks: '',
    },
  });

  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createReceipt(d, actor); onSuccess(); })} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="receipt_date" render={({ field }) => (
          <FormItem><FormLabel>Receipt Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="material_type" render={({ field }) => (
          <FormItem><FormLabel>Material Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>{WAREHOUSE_MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="material_code" render={({ field }) => (
          <FormItem><FormLabel>Material Code *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="material_name" render={({ field }) => (
          <FormItem><FormLabel>Material Name *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="vendor_doc_id" render={() => (
        <FormItem><FormLabel>Vendor (Approved only)</FormLabel>
          <VendorPicker vendors={vendors} value={form.watch('vendor_doc_id') || ''} onChange={(id, name) => {
            form.setValue('vendor_doc_id', id); form.setValue('vendor_name', name);
          }} /></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="manufacturer_name" render={({ field }) => (
          <FormItem><FormLabel>Manufacturer</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="supplier_name" render={({ field }) => (
          <FormItem><FormLabel>Supplier</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="invoice_number" render={({ field }) => (
          <FormItem><FormLabel>Invoice No</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="po_number" render={({ field }) => (
          <FormItem><FormLabel>PO Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="batch_lot_number" render={({ field }) => (
        <FormItem><FormLabel>Batch / Lot No *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
      )} />
      <div className="grid grid-cols-3 gap-3">
        <FormField control={form.control} name="mfg_date" render={({ field }) => (
          <FormItem><FormLabel>MFG Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="exp_date" render={({ field }) => (
          <FormItem><FormLabel>EXP Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="retest_date" render={({ field }) => (
          <FormItem><FormLabel>Retest Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField control={form.control} name="received_quantity" render={({ field }) => (
          <FormItem><FormLabel>Quantity *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="unit" render={({ field }) => (
          <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="container_count" render={({ field }) => (
          <FormItem><FormLabel>Containers</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="storage_condition" render={({ field }) => (
        <FormItem><FormLabel>Storage Condition</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>{STORAGE_CONDITIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select></FormItem>
      )} />
      <FormField control={form.control} name="coa_available" render={({ field }) => (
        <FormItem className="flex items-center gap-2"><FormLabel>COA Available</FormLabel>
          <Switch checked={field.value} onCheckedChange={field.onChange} /></FormItem>
      )} />
      <FormField control={form.control} name="remarks" render={({ field }) => (
        <FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
      )} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Create GRN</Button>
    </form></Form>
  );
}

export function SamplingForm({ receipts, onSuccess }: { receipts: MaterialReceipt[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useWarehouseActor();
  const form = useForm<SamplingInput>({
    resolver: zodResolver(samplingSchema),
    defaultValues: {
      receipt_doc_id: '', grn_number: '', material_name: '', ar_number: '',
      sample_quantity: 0, sampling_date: new Date().toISOString().split('T')[0],
      qc_status: 'Under Test', remarks: '',
    },
  });
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createSampling(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="receipt_doc_id" render={() => (
        <FormItem><FormLabel>GRN / Receipt</FormLabel>
          <ReceiptPicker receipts={receipts.filter((r) => ['Quarantine', 'Under Sampling'].includes(r.status))} value={form.watch('receipt_doc_id')}
            onChange={(id, grn, ar, name) => { form.setValue('receipt_doc_id', id); form.setValue('grn_number', grn); form.setValue('ar_number', ar); form.setValue('material_name', name); }} /></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="sample_quantity" render={({ field }) => (
          <FormItem><FormLabel>Sample Qty</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="sampling_date" render={({ field }) => (
          <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="qc_status" render={({ field }) => (
        <FormItem><FormLabel>QC Status</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>{QC_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select></FormItem>
      )} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Record Sampling</Button>
    </form></Form>
  );
}

export function ReleaseForm({ receipts, onSuccess }: { receipts: MaterialReceipt[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useWarehouseActor();
  const form = useForm<ReleaseInput>({
    resolver: zodResolver(releaseSchema),
    defaultValues: {
      receipt_doc_id: '', grn_number: '', ar_number: '', qc_result: 'Approved',
      released_quantity: 0, rejected_quantity: 0, release_date: new Date().toISOString().split('T')[0],
      status: 'Released', remarks: '',
    },
  });
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createRelease(d, actor); onSuccess(); })} className="space-y-4">
      <FormField control={form.control} name="receipt_doc_id" render={() => (
        <FormItem><FormLabel>GRN / Receipt</FormLabel>
          <ReceiptPicker receipts={receipts.filter((r) => ['Under Test', 'Under Sampling'].includes(r.status))} value={form.watch('receipt_doc_id')}
            onChange={(id, grn, ar) => { form.setValue('receipt_doc_id', id); form.setValue('grn_number', grn); form.setValue('ar_number', ar); }} /></FormItem>
      )} />
      <FormField control={form.control} name="qc_result" render={({ field }) => (
        <FormItem><FormLabel>QC Result</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>{QC_STATUSES.filter((s) => ['Approved', 'Rejected'].includes(s)).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="released_quantity" render={({ field }) => (
          <FormItem><FormLabel>Released Qty</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="rejected_quantity" render={({ field }) => (
          <FormItem><FormLabel>Rejected Qty</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="release_date" render={({ field }) => (
        <FormItem><FormLabel>Release Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
      )} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Release Material</Button>
    </form></Form>
  );
}

export function DispensingForm({ inventory, onSuccess }: { inventory: InventoryStock[]; onSuccess: () => void; onClose: () => void }) {
  const actor = useWarehouseActor();
  const [fifoHint, setFifoHint] = useState<string | null>(null);
  const form = useForm<DispensingInput>({
    resolver: zodResolver(dispensingSchema),
    defaultValues: {
      product_name: '', batch_number: '', material_name: '', material_code: '',
      ar_number: '', receipt_doc_id: '', required_quantity: 0, dispensed_quantity: 0,
      dispensing_date: new Date().toISOString().split('T')[0], remarks: '',
    },
  });

  const code = form.watch('material_code');
  useEffect(() => {
    if (code) suggestFifoLots(code).then((lots) => {
      if (lots.length) setFifoHint(`FIFO/FEFO suggestion: use AR ${lots[0].ar_number} (exp ${lots[0].exp_date || 'N/A'})`);
    });
  }, [code]);

  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createDispensing(d, actor); onSuccess(); })} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="product_name" render={({ field }) => (
          <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="batch_number" render={({ field }) => (
          <FormItem><FormLabel>Batch Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="ar_number" render={() => (
        <FormItem><FormLabel>Material AR / Lot</FormLabel>
          <InventoryPicker inventory={inventory} value={form.watch('ar_number')}
            onChange={(ar, receiptId, name, matCode, available) => {
              form.setValue('ar_number', ar); form.setValue('receipt_doc_id', receiptId);
              form.setValue('material_name', name); form.setValue('material_code', matCode);
            }} /></FormItem>
      )} />
      {fifoHint && <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">{fifoHint}</p>}
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="required_quantity" render={({ field }) => (
          <FormItem><FormLabel>Required Qty</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="dispensed_quantity" render={({ field }) => (
          <FormItem><FormLabel>Dispensed Qty</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="dispensing_date" render={({ field }) => (
        <FormItem><FormLabel>Dispensing Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
      )} />
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Record Dispensing</Button>
    </form></Form>
  );
}

export function FinishedGoodsForm({ onSuccess }: { onSuccess: () => void; onClose: () => void }) {
  const actor = useWarehouseActor();
  const form = useForm<FinishedGoodsInput>({
    resolver: zodResolver(finishedGoodsSchema),
    defaultValues: {
      fg_batch_number: '', product_name: '', mfg_date: new Date().toISOString().split('T')[0],
      exp_date: '', packed_quantity: 0, customer: '', market: '', source_batch_number: '', remarks: '',
    },
  });
  return (
    <Form {...form}><form onSubmit={form.handleSubmit(async (d) => { await createFinishedGoods(d, actor); onSuccess(); })} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="fg_batch_number" render={({ field }) => (
          <FormItem><FormLabel>FG Batch No *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="product_name" render={({ field }) => (
          <FormItem><FormLabel>Product Name *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField control={form.control} name="mfg_date" render={({ field }) => (
          <FormItem><FormLabel>MFG Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="exp_date" render={({ field }) => (
          <FormItem><FormLabel>EXP Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="packed_quantity" render={({ field }) => (
          <FormItem><FormLabel>Packed Qty</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
        )} />
      </div>
      <FormField control={form.control} name="source_batch_number" render={({ field }) => (
        <FormItem><FormLabel>Source Production Batch</FormLabel><FormControl><Input {...field} placeholder="Links to dispensing batch for traceability" /></FormControl></FormItem>
      )} />
      <div className="grid grid-cols-2 gap-3">
        <FormField control={form.control} name="customer" render={({ field }) => (
          <FormItem><FormLabel>Customer</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="market" render={({ field }) => (
          <FormItem><FormLabel>Market</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
      </div>
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Create FG Record</Button>
    </form></Form>
  );
}
