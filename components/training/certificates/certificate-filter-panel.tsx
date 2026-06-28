'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CERTIFICATE_STATUSES, APPROVAL_STATUSES, type CertificateFilters } from '@/lib/training-certificate-types';
import { TMS_DEPARTMENTS, TRAINING_TYPES } from '@/lib/training-types';

export function CertificateFilterPanel({
  filters, onChange, employees = [], trainers = [],
}: {
  filters: CertificateFilters;
  onChange: (f: CertificateFilters) => void;
  employees?: { id: string; name: string }[];
  trainers?: string[];
}) {
  const set = (patch: Partial<CertificateFilters>) => onChange({ ...filters, ...patch });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Advanced Filters</CardTitle>
        <CardDescription>Filter certificates by department, status, dates, and more.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Label>Search</Label>
          <Input placeholder="Certificate #, employee, topic, verification code…" value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} />
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
        <div><Label>Certificate Status</Label>
          <Select value={filters.certificate_status ?? 'all'} onValueChange={(v) => set({ certificate_status: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{CERTIFICATE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Approval Status</Label>
          <Select value={filters.approval_status ?? 'all'} onValueChange={(v) => set({ approval_status: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{APPROVAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Trainer</Label>
          <Select value={filters.trainer ?? 'all'} onValueChange={(v) => set({ trainer: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{trainers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Issue From</Label><Input type="date" value={filters.issue_date_from ?? ''} onChange={(e) => set({ issue_date_from: e.target.value || undefined })} /></div>
        <div><Label>Issue To</Label><Input type="date" value={filters.issue_date_to ?? ''} onChange={(e) => set({ issue_date_to: e.target.value || undefined })} /></div>
        <div><Label>Expiry From</Label><Input type="date" value={filters.expiry_date_from ?? ''} onChange={(e) => set({ expiry_date_from: e.target.value || undefined })} /></div>
        <div><Label>Expiry To</Label><Input type="date" value={filters.expiry_date_to ?? ''} onChange={(e) => set({ expiry_date_to: e.target.value || undefined })} /></div>
      </CardContent>
    </Card>
  );
}
