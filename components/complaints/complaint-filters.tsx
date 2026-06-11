'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COMPLAINT_CATEGORIES, COMPLAINT_CRITICALITIES } from '@/lib/complaint-schemas';
import { COMPLAINT_STATUSES } from '@/lib/complaint-types';
import type { ComplaintFilters } from '@/lib/complaint-types';

export function ComplaintFiltersBar({ filters, onChange }: { filters: ComplaintFilters; onChange: (f: ComplaintFilters) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <Input placeholder="Search…" value={filters.search || ''} onChange={(e) => onChange({ ...filters, search: e.target.value })} />
      <Select value={filters.status || 'all'} onValueChange={(v) => onChange({ ...filters, status: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Statuses</SelectItem>{COMPLAINT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.complaint_category || 'all'} onValueChange={(v) => onChange({ ...filters, complaint_category: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Categories</SelectItem>{COMPLAINT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.complaint_criticality || 'all'} onValueChange={(v) => onChange({ ...filters, complaint_criticality: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Criticality" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All</SelectItem>{COMPLAINT_CRITICALITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
      <Input placeholder="Product" value={filters.product || ''} onChange={(e) => onChange({ ...filters, product: e.target.value || undefined })} />
    </div>
  );
}
