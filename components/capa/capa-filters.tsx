'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CAPA_SOURCES, CAPA_DEPARTMENTS, CAPA_PRIORITIES } from '@/lib/capa-schemas';
import { CAPA_STATUSES } from '@/lib/capa-types';
import type { CapaFilters } from '@/lib/capa-types';

interface CapaFiltersBarProps {
  filters: CapaFilters;
  onChange: (filters: CapaFilters) => void;
}

export function CapaFiltersBar({ filters, onChange }: CapaFiltersBarProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <Input
        placeholder="Search CAPA, product, batch…"
        value={filters.search || ''}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />
      <Select value={filters.status || 'all'} onValueChange={(v) => onChange({ ...filters, status: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {CAPA_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.source || 'all'} onValueChange={(v) => onChange({ ...filters, source: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          {CAPA_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.department || 'all'} onValueChange={(v) => onChange({ ...filters, department: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {CAPA_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.priority || 'all'} onValueChange={(v) => onChange({ ...filters, priority: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {CAPA_PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
