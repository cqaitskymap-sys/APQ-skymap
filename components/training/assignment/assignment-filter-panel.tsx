'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ASSIGNMENT_TRAINING_MODES, TRAINING_ASSIGNMENT_STATUSES, type AssignmentFilters,
} from '@/lib/training-assignment-types';
import { TMS_DEPARTMENTS, TRAINING_TYPES } from '@/lib/training-types';

const SOURCES = ['manual', 'bulk', 'department', 'scheduled', 'matrix', 'dms_revision', 'retraining'];

export function AssignmentFilterPanel({
  filters, onChange, employees = [], trainers = [],
}: {
  filters: AssignmentFilters;
  onChange: (f: AssignmentFilters) => void;
  employees?: { id: string; name: string }[];
  trainers?: string[];
}) {
  const set = (patch: Partial<AssignmentFilters>) => onChange({ ...filters, ...patch });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Advanced Filters</CardTitle>
        <CardDescription>Filter assignments by department, status, mode, trainer, and dates.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Label>Search</Label>
          <Input placeholder="Training #, employee, topic…" value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} />
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
        <div><Label>Training Type</Label>
          <Select value={filters.training_type ?? 'all'} onValueChange={(v) => set({ training_type: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Status</Label>
          <Select value={filters.training_status ?? 'all'} onValueChange={(v) => set({ training_status: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{TRAINING_ASSIGNMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Training Mode</Label>
          <Select value={filters.training_mode ?? 'all'} onValueChange={(v) => set({ training_mode: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{ASSIGNMENT_TRAINING_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Trainer</Label>
          <Select value={filters.trainer ?? 'all'} onValueChange={(v) => set({ trainer: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{trainers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Source</Label>
          <Select value={filters.source ?? 'all'} onValueChange={(v) => set({ source: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Assigned From</Label><Input type="date" value={filters.date_from ?? ''} onChange={(e) => set({ date_from: e.target.value || undefined })} /></div>
        <div><Label>Due By</Label><Input type="date" value={filters.date_to ?? ''} onChange={(e) => set({ date_to: e.target.value || undefined })} /></div>
      </CardContent>
    </Card>
  );
}
