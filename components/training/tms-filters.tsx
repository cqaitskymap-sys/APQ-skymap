'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { TMS_DEPARTMENTS, TRAINING_TYPES, ASSIGNMENT_STATUSES } from '@/lib/training-types';
import type { TmsFilters } from '@/lib/training-types';

export function TmsFiltersBar({ filters, onChange }: { filters: TmsFilters; onChange: (f: TmsFilters) => void }) {
  const update = (key: keyof TmsFilters, value: string) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input placeholder="Search…" className="w-full sm:w-56" value={filters.search || ''} onChange={(e) => update('search', e.target.value)} />
      <Select value={filters.status || 'all'} onValueChange={(v) => update('status', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {ASSIGNMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.department || 'all'} onValueChange={(v) => update('department', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Department" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.training_type || 'all'} onValueChange={(v) => update('training_type', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      {(filters.search || filters.status || filters.department || filters.training_type) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}><X className="h-4 w-4 mr-1" />Clear</Button>
      )}
    </div>
  );
}
