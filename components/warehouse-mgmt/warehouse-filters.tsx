'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { WAREHOUSE_MATERIAL_TYPES, RECEIPT_STATUSES } from '@/lib/warehouse-mgmt-types';
import type { WarehouseFilters } from '@/lib/warehouse-mgmt-types';
import type { MaterialReceipt, InventoryStock } from '@/lib/warehouse-mgmt-types';
import type { VendorRecord } from '@/lib/vendor-mgmt-types';

export function WarehouseFiltersBar({ filters, onChange }: { filters: WarehouseFilters; onChange: (f: WarehouseFilters) => void }) {
  const update = (key: keyof WarehouseFilters, value: string) => onChange({ ...filters, [key]: value || undefined });
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input placeholder="Search GRN, AR, material…" className="w-full sm:w-56" value={filters.search || ''} onChange={(e) => update('search', e.target.value)} />
      <Select value={filters.material_type || 'all'} onValueChange={(v) => update('material_type', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Types</SelectItem>{WAREHOUSE_MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.status || 'all'} onValueChange={(v) => update('status', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Status</SelectItem>{RECEIPT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
      {(filters.search || filters.material_type || filters.status) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}><X className="h-4 w-4 mr-1" />Clear</Button>
      )}
    </div>
  );
}

export function ReceiptPicker({ receipts, value, onChange }: {
  receipts: MaterialReceipt[]; value: string;
  onChange: (docId: string, grn: string, ar: string, name: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => {
      const r = receipts.find((x) => x.id === v);
      if (r) onChange(r.id, r.grn_number, r.ar_number, r.material_name);
    }}>
      <SelectTrigger><SelectValue placeholder="Select GRN / receipt" /></SelectTrigger>
      <SelectContent>{receipts.map((r) => <SelectItem key={r.id} value={r.id}>{r.grn_number} — {r.material_name} ({r.ar_number})</SelectItem>)}</SelectContent>
    </Select>
  );
}

export function InventoryPicker({ inventory, value, onChange }: {
  inventory: InventoryStock[]; value: string;
  onChange: (ar: string, receiptId: string, name: string, code: string, available: number) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => {
      const i = inventory.find((x) => x.ar_number === v);
      if (i) onChange(i.ar_number, i.receipt_doc_id, i.material_name, i.material_code, i.available_quantity);
    }}>
      <SelectTrigger><SelectValue placeholder="Select AR / lot" /></SelectTrigger>
      <SelectContent>{inventory.filter((i) => i.available_quantity > 0).map((i) => (
        <SelectItem key={i.id} value={i.ar_number}>{i.ar_number} — {i.material_name} ({i.available_quantity} {i.unit})</SelectItem>
      ))}</SelectContent>
    </Select>
  );
}

export function VendorPicker({ vendors, value, onChange }: {
  vendors: VendorRecord[]; value: string;
  onChange: (docId: string, name: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => {
      const vendor = vendors.find((x) => x.id === v);
      if (vendor) onChange(vendor.id, vendor.vendor_name);
    }}>
      <SelectTrigger><SelectValue placeholder="Select approved vendor" /></SelectTrigger>
      <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.vendor_code} — {v.vendor_name}</SelectItem>)}</SelectContent>
    </Select>
  );
}
