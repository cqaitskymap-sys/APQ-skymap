'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RECALL_TYPES, RECALL_CLASSIFICATIONS } from '@/lib/recall-schemas';
import { RECALL_STATUSES } from '@/lib/recall-types';
import type { RecallFilters } from '@/lib/recall-types';

export function RecallFiltersBar({
  filters,
  onChange,
  onFilterChange,
}: {
  filters: RecallFilters;
  onChange: (f: RecallFilters) => void;
  onFilterChange?: () => void;
}) {
  const update = (patch: Partial<RecallFilters>) => {
    onChange({ ...filters, ...patch });
    onFilterChange?.();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Search</Label>
        <Input placeholder="Recall no, product, batch..." value={filters.search || ''} onChange={(e) => update({ search: e.target.value || undefined })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Product</Label>
        <Input placeholder="Product name" value={filters.product || ''} onChange={(e) => update({ product: e.target.value || undefined })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Market</Label>
        <Input placeholder="Market / region" value={filters.market_region || ''} onChange={(e) => update({ market_region: e.target.value || undefined })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Classification</Label>
        <Select value={filters.recall_classification || 'all'} onValueChange={(v) => update({ recall_classification: v === 'all' ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Classification" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {RECALL_CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Status</Label>
        <Select value={filters.recall_status || 'all'} onValueChange={(v) => update({ recall_status: v === 'all' ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {RECALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Type</Label>
        <Select value={filters.recall_type || 'all'} onValueChange={(v) => update({ recall_type: v === 'all' ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {RECALL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">From Date</Label>
        <Input type="date" value={filters.date_from || ''} onChange={(e) => update({ date_from: e.target.value || undefined })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To Date</Label>
        <Input type="date" value={filters.date_to || ''} onChange={(e) => update({ date_to: e.target.value || undefined })} />
      </div>
    </div>
  );
}
