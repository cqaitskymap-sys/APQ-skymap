'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WORKFLOW_TYPES, WORKFLOW_STATUSES, PRIORITIES, type ApprovalFilters } from '@/lib/training-approval-types';
import { TMS_DEPARTMENTS } from '@/lib/training-types';

interface FilterPanelProps {
  filters: ApprovalFilters;
  onChange: (filters: ApprovalFilters) => void;
}

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const set = (patch: Partial<ApprovalFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap gap-2">
      <Input
        placeholder="Search workflow #, reference…"
        className="max-w-xs"
        value={filters.search ?? ''}
        onChange={(e) => set({ search: e.target.value })}
      />
      <Select value={filters.workflowType ?? 'all'} onValueChange={(v) => set({ workflowType: v === 'all' ? undefined : v })}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Workflow Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {WORKFLOW_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.status ?? 'all'} onValueChange={(v) => set({ status: v === 'all' ? undefined : v })}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          {WORKFLOW_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.department ?? 'all'} onValueChange={(v) => set({ department: v === 'all' ? undefined : v })}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Department" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Depts</SelectItem>
          {TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.priority ?? 'all'} onValueChange={(v) => set({ priority: v === 'all' ? undefined : v })}>
        <SelectTrigger className="w-[120px]"><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input type="date" className="w-[140px]" value={filters.dateFrom ?? ''} onChange={(e) => set({ dateFrom: e.target.value || undefined })} />
      <Input type="date" className="w-[140px]" value={filters.dateTo ?? ''} onChange={(e) => set({ dateTo: e.target.value || undefined })} />
    </div>
  );
}
