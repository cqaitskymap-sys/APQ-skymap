'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { SYSTEM_TYPES, CSV_STATUSES, CSV_DEPARTMENTS } from '@/lib/csv-mgmt-types';
import type { CsvFilters } from '@/lib/csv-mgmt-types';

export function CsvFiltersBar({ filters, onChange }: { filters: CsvFilters; onChange: (f: CsvFilters) => void }) {
  const update = (key: keyof CsvFilters, value: string) => onChange({ ...filters, [key]: value || undefined });
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input placeholder="Search system ID, name, owner…" className="w-full sm:w-56" value={filters.search || ''} onChange={(e) => update('search', e.target.value)} />
      <Select value={filters.system_type || 'all'} onValueChange={(v) => update('system_type', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Types</SelectItem>{SYSTEM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.validation_status || 'all'} onValueChange={(v) => update('validation_status', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Status</SelectItem>{CSV_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.department || 'all'} onValueChange={(v) => update('department', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Dept" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Depts</SelectItem>{CSV_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
      </Select>
      {(filters.search || filters.system_type || filters.validation_status || filters.department) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}><X className="h-4 w-4 mr-1" />Clear</Button>
      )}
    </div>
  );
}

export function SystemPicker({ systems, value, onChange }: { systems: { id: string; system_name: string; system_id: string }[]; value: string; onChange: (id: string, name: string) => void }) {
  return (
    <Select value={value} onValueChange={(v) => { const s = systems.find((x) => x.id === v); if (s) onChange(s.id, s.system_name); }}>
      <SelectTrigger><SelectValue placeholder="Select system" /></SelectTrigger>
      <SelectContent>{systems.map((s) => <SelectItem key={s.id} value={s.id}>{s.system_id} — {s.system_name}</SelectItem>)}</SelectContent>
    </Select>
  );
}
