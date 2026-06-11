'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { VENDOR_TYPES, APPROVAL_STATUSES, RISK_CATEGORIES } from '@/lib/vendor-mgmt-types';
import type { VendorFilters } from '@/lib/vendor-mgmt-types';

export function VendorFiltersBar({ filters, onChange }: { filters: VendorFilters; onChange: (f: VendorFilters) => void }) {
  const update = (key: keyof VendorFilters, value: string) => onChange({ ...filters, [key]: value || undefined });
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input placeholder="Search code, name, material…" className="w-full sm:w-56" value={filters.search || ''} onChange={(e) => update('search', e.target.value)} />
      <Select value={filters.approval_status || 'all'} onValueChange={(v) => update('approval_status', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Approval" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Approvals</SelectItem>{APPROVAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.vendor_type || 'all'} onValueChange={(v) => update('vendor_type', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Types</SelectItem>{VENDOR_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.risk_category || 'all'} onValueChange={(v) => update('risk_category', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Risk" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Risk</SelectItem>{RISK_CATEGORIES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
      </Select>
      {(filters.search || filters.approval_status || filters.vendor_type || filters.risk_category) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}><X className="h-4 w-4 mr-1" />Clear</Button>
      )}
    </div>
  );
}
