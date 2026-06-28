'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MATRIX_FREQUENCIES, MATRIX_STATUSES, type MatrixFilters,
} from '@/lib/training-matrix-types';
import { TMS_DEPARTMENTS, TRAINING_TYPES } from '@/lib/training-types';

export function MatrixFilterPanel({
  filters, onChange,
}: {
  filters: MatrixFilters;
  onChange: (f: MatrixFilters) => void;
}) {
  const set = (patch: Partial<MatrixFilters>) => onChange({ ...filters, ...patch });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Advanced Filters</CardTitle>
        <CardDescription>Filter matrix by department, designation, frequency, and document.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Label>Search</Label>
          <Input placeholder="Matrix code, topic, document, SOP…" value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} />
        </div>
        <div><Label>Department</Label>
          <Select value={filters.department ?? 'all'} onValueChange={(v) => set({ department: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Designation</Label><Input value={filters.designation ?? ''} onChange={(e) => set({ designation: e.target.value || undefined })} placeholder="Filter designation" /></div>
        <div><Label>Training Type</Label>
          <Select value={filters.training_type ?? 'all'} onValueChange={(v) => set({ training_type: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Frequency</Label>
          <Select value={filters.training_frequency ?? 'all'} onValueChange={(v) => set({ training_frequency: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{MATRIX_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Status</Label>
          <Select value={filters.status ?? 'all'} onValueChange={(v) => set({ status: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{MATRIX_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Document #</Label><Input value={filters.document_number ?? ''} onChange={(e) => set({ document_number: e.target.value || undefined })} /></div>
        <div><Label>SOP #</Label><Input value={filters.sop_number ?? ''} onChange={(e) => set({ sop_number: e.target.value || undefined })} /></div>
      </CardContent>
    </Card>
  );
}
