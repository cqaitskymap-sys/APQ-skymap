'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { VALIDATION_TYPES, VALIDATION_STATUSES, VALIDATION_DEPARTMENTS } from '@/lib/validation-mgmt-types';
import type { ValidationFilters } from '@/lib/validation-mgmt-types';

export function ValidationFiltersBar({ filters, onChange, hideType }: { filters: ValidationFilters; onChange: (f: ValidationFilters) => void; hideType?: boolean }) {
  const update = (key: keyof ValidationFilters, value: string) => onChange({ ...filters, [key]: value || undefined });
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input placeholder="Search number, title, equipment…" className="w-full sm:w-56" value={filters.search || ''} onChange={(e) => update('search', e.target.value)} />
      {!hideType && (
        <Select value={filters.validation_type || 'all'} onValueChange={(v) => update('validation_type', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem>{VALIDATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      )}
      <Select value={filters.validation_status || 'all'} onValueChange={(v) => update('validation_status', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Status</SelectItem>{VALIDATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.department || 'all'} onValueChange={(v) => update('department', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Dept" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Depts</SelectItem>{VALIDATION_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
      </Select>
      {(filters.search || filters.validation_type || filters.validation_status || filters.department) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...filters, search: undefined, validation_type: hideType ? filters.validation_type : undefined, validation_status: undefined, department: undefined })}><X className="h-4 w-4 mr-1" />Clear</Button>
      )}
    </div>
  );
}
