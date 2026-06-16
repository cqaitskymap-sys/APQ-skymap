'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CAPA_SOURCES, CAPA_DEPARTMENTS, CAPA_PRIORITIES } from '@/lib/capa-schemas';
import { CAPA_STATUSES, EFFECTIVENESS_RESULTS } from '@/lib/capa-types';
import type { CapaFilters } from '@/lib/capa-types';

interface CapaFiltersBarProps {
  filters: CapaFilters;
  onChange: (filters: CapaFilters) => void;
}

export function CapaFiltersBar({ filters, onChange }: CapaFiltersBarProps) {
  const set = (patch: Partial<CapaFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Search</Label>
        <Input
          placeholder="CAPA number, title, product, batch, owner…"
          value={filters.search || ''}
          onChange={(e) => set({ search: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">CAPA Number</Label>
        <Input
          placeholder="CAPA-..."
          value={filters.capa_number || ''}
          onChange={(e) => set({ capa_number: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Source</Label>
        <Select value={filters.source || 'all'} onValueChange={(v) => set({ source: v === 'all' ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {CAPA_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Department</Label>
        <Select value={filters.department || 'all'} onValueChange={(v) => set({ department: v === 'all' ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {CAPA_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Owner</Label>
        <Input
          placeholder="Owner name"
          value={filters.owner || ''}
          onChange={(e) => set({ owner: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Status</Label>
        <Select value={filters.status || 'all'} onValueChange={(v) => set({ status: v === 'all' ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {CAPA_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Priority</Label>
        <Select value={filters.priority || 'all'} onValueChange={(v) => set({ priority: v === 'all' ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {CAPA_PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Effectiveness</Label>
        <Select
          value={filters.effectiveness_result || 'all'}
          onValueChange={(v) => set({ effectiveness_result: v === 'all' ? undefined : v })}
        >
          <SelectTrigger><SelectValue placeholder="Effectiveness" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            {EFFECTIVENESS_RESULTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">From Date</Label>
        <Input type="date" value={filters.date_from || ''} onChange={(e) => set({ date_from: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To Date</Label>
        <Input type="date" value={filters.date_to || ''} onChange={(e) => set({ date_to: e.target.value })} />
      </div>
      <div className="flex items-end gap-2 pb-1">
        <Checkbox
          id="overdue-only"
          checked={Boolean(filters.overdue_only)}
          onCheckedChange={(v) => set({ overdue_only: Boolean(v) })}
        />
        <Label htmlFor="overdue-only" className="text-sm cursor-pointer">Overdue only</Label>
      </div>
    </div>
  );
}
