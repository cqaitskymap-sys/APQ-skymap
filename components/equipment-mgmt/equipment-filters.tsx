'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { EQUIPMENT_TYPES, EQUIPMENT_STATUSES, EQUIPMENT_DEPARTMENTS } from '@/lib/equipment-mgmt-types';
import type { EquipmentFilters } from '@/lib/equipment-mgmt-types';

export function EquipmentFiltersBar({ filters, onChange }: { filters: EquipmentFilters; onChange: (f: EquipmentFilters) => void }) {
  const update = (key: keyof EquipmentFilters, value: string) => onChange({ ...filters, [key]: value || undefined });
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input placeholder="Search ID, name, serial…" className="w-full sm:w-56" value={filters.search || ''} onChange={(e) => update('search', e.target.value)} />
      <Select value={filters.equipment_type || 'all'} onValueChange={(v) => update('equipment_type', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Types</SelectItem>{EQUIPMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.equipment_status || 'all'} onValueChange={(v) => update('equipment_status', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Status</SelectItem>{EQUIPMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.department || 'all'} onValueChange={(v) => update('department', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Dept" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Depts</SelectItem>{EQUIPMENT_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
      </Select>
      {(filters.search || filters.equipment_type || filters.equipment_status || filters.department) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}><X className="h-4 w-4 mr-1" />Clear</Button>
      )}
    </div>
  );
}

export function EquipmentPicker({ equipment, value, onChange }: { equipment: { id: string; equipment_id: string; equipment_name: string }[]; value: string; onChange: (docId: string, eqId: string, name: string) => void }) {
  return (
    <Select value={value} onValueChange={(v) => { const e = equipment.find((x) => x.id === v); if (e) onChange(e.id, e.equipment_id, e.equipment_name); }}>
      <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
      <SelectContent>{equipment.map((e) => <SelectItem key={e.id} value={e.id}>{e.equipment_id} — {e.equipment_name}</SelectItem>)}</SelectContent>
    </Select>
  );
}
