'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HISTORY_STATUSES, HISTORY_TRAINING_TYPES, type HistoryFilters } from '@/lib/training-history-types';
import { TMS_DEPARTMENTS } from '@/lib/training-types';

export function HistoryFilterPanel({
  filters, onChange, employees = [], showDepartment = true, showEmployee = true,
}: {
  filters: HistoryFilters;
  onChange: (f: HistoryFilters) => void;
  employees?: { id: string; name: string; department: string }[];
  showDepartment?: boolean;
  showEmployee?: boolean;
}) {
  const set = (patch: Partial<HistoryFilters>) => onChange({ ...filters, ...patch });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Advanced Search & Filters</CardTitle>
        <CardDescription>Filter training history by department, type, status, and date range.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Label>Search</Label>
          <Input placeholder="Training #, topic, document, employee…" value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} />
        </div>
        {showDepartment && (
          <div><Label>Department</Label>
            <Select value={filters.department ?? 'all'} onValueChange={(v) => set({ department: v === 'all' ? undefined : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {showEmployee && (
          <div><Label>Employee</Label>
            <Select value={filters.employee_id ?? 'all'} onValueChange={(v) => set({ employee_id: v === 'all' ? undefined : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div><Label>Training Type</Label>
          <Select value={filters.training_type ?? 'all'} onValueChange={(v) => set({ training_type: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{HISTORY_TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Status</Label>
          <Select value={filters.status ?? 'all'} onValueChange={(v) => set({ status: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{HISTORY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Date From</Label><Input type="date" value={filters.date_from ?? ''} onChange={(e) => set({ date_from: e.target.value || undefined })} /></div>
        <div><Label>Date To</Label><Input type="date" value={filters.date_to ?? ''} onChange={(e) => set({ date_to: e.target.value || undefined })} /></div>
      </CardContent>
    </Card>
  );
}
