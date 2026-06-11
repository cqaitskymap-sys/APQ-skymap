'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STUDY_TYPES, STORAGE_CONDITIONS } from '@/lib/stability-schemas';
import { STUDY_STATUSES } from '@/lib/stability-types';
import type { StabilityFilters } from '@/lib/stability-types';

interface StabilityFiltersBarProps {
  filters: StabilityFilters;
  onChange: (filters: StabilityFilters) => void;
}

export function StabilityFiltersBar({ filters, onChange }: StabilityFiltersBarProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
      <Input
        placeholder="Search study #, product, batch…"
        value={filters.search || ''}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <Input
        placeholder="Product name"
        value={filters.product || ''}
        onChange={(e) => onChange({ ...filters, product: e.target.value || undefined })}
      />
      <Input
        placeholder="Batch number"
        value={filters.batch_number || ''}
        onChange={(e) => onChange({ ...filters, batch_number: e.target.value || undefined })}
      />
      <Select value={filters.study_type || 'all'} onValueChange={(v) => onChange({ ...filters, study_type: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Study Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {STUDY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.storage_condition || 'all'} onValueChange={(v) => onChange({ ...filters, storage_condition: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Storage" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Conditions</SelectItem>
          {STORAGE_CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.status || 'all'} onValueChange={(v) => onChange({ ...filters, status: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {STUDY_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
