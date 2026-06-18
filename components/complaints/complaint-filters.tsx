'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COMPLAINT_CATEGORIES, COMPLAINT_CRITICALITIES } from '@/lib/complaint-schemas';
import { COMPLAINT_STATUSES } from '@/lib/complaint-types';
import type { ComplaintFilters } from '@/lib/complaint-types';

interface ComplaintFiltersBarProps {
  filters: ComplaintFilters;
  onChange: (filters: ComplaintFilters) => void;
}

export function ComplaintFiltersBar({ filters, onChange }: ComplaintFiltersBarProps) {
  const set = (patch: Partial<ComplaintFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs">Search</Label>
        <Input
          placeholder="Complaint no, product, customer, batch…"
          value={filters.search || ''}
          onChange={(e) => set({ search: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Status</Label>
        <Select value={filters.status || 'all'} onValueChange={(v) => set({ status: v === 'all' ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {COMPLAINT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Category</Label>
        <Select value={filters.complaint_category || 'all'} onValueChange={(v) => set({ complaint_category: v === 'all' ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {COMPLAINT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Criticality</Label>
        <Select value={filters.complaint_criticality || 'all'} onValueChange={(v) => set({ complaint_criticality: v === 'all' ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Criticality" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {COMPLAINT_CRITICALITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Product</Label>
        <Input
          placeholder="Product name"
          value={filters.product || ''}
          onChange={(e) => set({ product: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Market</Label>
        <Input
          placeholder="Market / region"
          value={filters.market_region || ''}
          onChange={(e) => set({ market_region: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Date From</Label>
        <Input
          type="date"
          value={filters.date_from || ''}
          onChange={(e) => set({ date_from: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Date To</Label>
        <Input
          type="date"
          value={filters.date_to || ''}
          onChange={(e) => set({ date_to: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}
