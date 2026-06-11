'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CHANGE_TYPES, CHANGE_CATEGORIES, CC_DEPARTMENTS } from '@/lib/change-control-schemas';
import { CC_STATUSES } from '@/lib/change-control-types';
import type { CcFilters } from '@/lib/change-control-types';

interface CcFiltersBarProps {
  filters: CcFilters;
  onChange: (filters: CcFilters) => void;
}

export function CcFiltersBar({ filters, onChange }: CcFiltersBarProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <Input
        placeholder="Search CC number, title, product…"
        value={filters.search || ''}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <Select value={filters.status || 'all'} onValueChange={(v) => onChange({ ...filters, status: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {CC_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.change_type || 'all'} onValueChange={(v) => onChange({ ...filters, change_type: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Change Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {CHANGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.change_category || 'all'} onValueChange={(v) => onChange({ ...filters, change_category: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {CHANGE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.department || 'all'} onValueChange={(v) => onChange({ ...filters, department: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {CC_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
