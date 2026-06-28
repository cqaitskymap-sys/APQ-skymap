'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  EVALUATION_TYPES, EVALUATION_RESULTS, EVALUATION_STATUSES, type EffectivenessFilters,
} from '@/lib/training-effectiveness-types';
import { TMS_DEPARTMENTS } from '@/lib/training-types';

export function EffectivenessFilterPanel({
  filters, onChange, employees = [], evaluators = [],
}: {
  filters: EffectivenessFilters;
  onChange: (f: EffectivenessFilters) => void;
  employees?: { id: string; name: string }[];
  evaluators?: string[];
}) {
  const set = (patch: Partial<EffectivenessFilters>) => onChange({ ...filters, ...patch });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Advanced Filters</CardTitle>
        <CardDescription>Filter evaluations by department, type, result, status, and dates.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Label>Search</Label>
          <Input placeholder="Evaluation #, employee, topic…" value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} />
        </div>
        <div><Label>Department</Label>
          <Select value={filters.department ?? 'all'} onValueChange={(v) => set({ department: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Employee</Label>
          <Select value={filters.employee_id ?? 'all'} onValueChange={(v) => set({ employee_id: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Evaluation Type</Label>
          <Select value={filters.evaluation_type ?? 'all'} onValueChange={(v) => set({ evaluation_type: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{EVALUATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Result</Label>
          <Select value={filters.result ?? 'all'} onValueChange={(v) => set({ result: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{EVALUATION_RESULTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Status</Label>
          <Select value={filters.status ?? 'all'} onValueChange={(v) => set({ status: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{EVALUATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Evaluator</Label>
          <Select value={filters.evaluator ?? 'all'} onValueChange={(v) => set({ evaluator: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{evaluators.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Date From</Label><Input type="date" value={filters.date_from ?? ''} onChange={(e) => set({ date_from: e.target.value || undefined })} /></div>
        <div><Label>Date To</Label><Input type="date" value={filters.date_to ?? ''} onChange={(e) => set({ date_to: e.target.value || undefined })} /></div>
      </CardContent>
    </Card>
  );
}
