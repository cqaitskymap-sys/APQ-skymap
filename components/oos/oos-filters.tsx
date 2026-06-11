'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { DEPARTMENTS, OOS_STATUSES } from '@/lib/oos-types';
import type { OosFilters } from '@/lib/oos-types';

export function OosFiltersBar({ filters, onChange }: { filters: OosFilters; onChange: (f: OosFilters) => void }) {
  const set = (key: keyof OosFilters, value: string) => onChange({ ...filters, [key]: value || undefined });
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Advanced Filters</p>
        <Button variant="ghost" size="sm" onClick={() => onChange({})} className="h-8 gap-1"><X className="h-3.5 w-3.5" />Clear</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-9" value={filters.search || ''} onChange={(e) => set('search', e.target.value)} /></div>
        <Input placeholder="OOS Number" value={filters.oos_number || ''} onChange={(e) => set('oos_number', e.target.value)} />
        <Input placeholder="Batch Number" value={filters.batch_number || ''} onChange={(e) => set('batch_number', e.target.value)} />
        <Select value={filters.department || 'all'} onValueChange={(v) => set('department', v === 'all' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Product" value={filters.product_name || ''} onChange={(e) => set('product_name', e.target.value)} />
        <Input placeholder="Test Name" value={filters.test_name || ''} onChange={(e) => set('test_name', e.target.value)} />
        <Select value={filters.status || 'all'} onValueChange={(v) => set('status', v === 'all' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem>{OOS_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={filters.date_from || ''} onChange={(e) => set('date_from', e.target.value)} />
        <Input type="date" value={filters.date_to || ''} onChange={(e) => set('date_to', e.target.value)} />
        <Select value={filters.capa_linked === undefined ? 'all' : filters.capa_linked ? 'yes' : 'no'} onValueChange={(v) => onChange({ ...filters, capa_linked: v === 'all' ? undefined : v === 'yes' })}>
          <SelectTrigger><SelectValue placeholder="CAPA Linked" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="yes">CAPA Linked</SelectItem><SelectItem value="no">No CAPA</SelectItem></SelectContent>
        </Select>
      </div>
    </div>
  );
}
