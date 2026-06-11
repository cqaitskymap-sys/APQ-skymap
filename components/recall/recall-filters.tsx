'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RECALL_TYPES, RECALL_CLASSIFICATIONS } from '@/lib/recall-schemas';
import { RECALL_STATUSES } from '@/lib/recall-types';
import type { RecallFilters } from '@/lib/recall-types';

export function RecallFiltersBar({ filters, onChange }: { filters: RecallFilters; onChange: (f: RecallFilters) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <Input placeholder="Search…" value={filters.search || ''} onChange={(e) => onChange({ ...filters, search: e.target.value })} />
      <Select value={filters.recall_status || 'all'} onValueChange={(v) => onChange({ ...filters, recall_status: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Statuses</SelectItem>{RECALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.recall_type || 'all'} onValueChange={(v) => onChange({ ...filters, recall_type: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Types</SelectItem>{RECALL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.recall_classification || 'all'} onValueChange={(v) => onChange({ ...filters, recall_classification: v === 'all' ? undefined : v })}>
        <SelectTrigger><SelectValue placeholder="Classification" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All</SelectItem>{RECALL_CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
      <Input placeholder="Product" value={filters.product || ''} onChange={(e) => onChange({ ...filters, product: e.target.value || undefined })} />
    </div>
  );
}
