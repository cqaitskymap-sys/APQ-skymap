'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EBMR_STATUSES } from '@/lib/ebmr-mgmt-types';
import type { EbmrFilters } from '@/lib/ebmr-mgmt-types';

export function EbmrFiltersBar({ filters, onChange }: { filters: EbmrFilters; onChange: (f: EbmrFilters) => void }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Input placeholder="Search eBMR, batch, product..." className="sm:max-w-xs"
        value={filters.search || ''} onChange={(e) => onChange({ ...filters, search: e.target.value })} />
      <Select value={filters.batch_status || 'all'} onValueChange={(v) => onChange({ ...filters, batch_status: v === 'all' ? undefined : v })}>
        <SelectTrigger className="sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {EBMR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
