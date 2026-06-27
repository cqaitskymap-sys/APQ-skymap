'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CHANGE_CATEGORIES,
  CHANGE_PRIORITIES,
  CHANGE_TYPES,
  type CcDashboardFilters,
} from '@/lib/cc-dashboard-records';

interface CcDashboardFiltersBarProps {
  filters: CcDashboardFilters;
  departments: string[];
  onChange: (patch: Partial<CcDashboardFilters>) => void;
}

export function CcDashboardFiltersBar({ filters, departments, onChange }: CcDashboardFiltersBarProps) {
  return (
    <div className="rounded-lg border bg-card p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <div className="space-y-1.5">
        <Label className="text-xs">Date From</Label>
        <Input type="date" value={filters.date_from} onChange={(e) => onChange({ date_from: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Date To</Label>
        <Input type="date" value={filters.date_to} onChange={(e) => onChange({ date_to: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Department</Label>
        <Select value={filters.department} onValueChange={(v) => onChange({ department: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Change Type</Label>
        <Select value={filters.change_type} onValueChange={(v) => onChange({ change_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Types</SelectItem>
            {CHANGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Category</Label>
        <Select value={filters.change_category} onValueChange={(v) => onChange({ change_category: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {CHANGE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Priority</Label>
        <Select value={filters.change_priority} onValueChange={(v) => onChange({ change_priority: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Priorities</SelectItem>
            {CHANGE_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
