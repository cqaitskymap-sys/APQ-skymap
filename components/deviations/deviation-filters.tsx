'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import {
  DEPARTMENTS, DEVIATION_CATEGORIES, DEVIATION_CRITICALITIES, DEVIATION_STATUSES,
} from '@/lib/deviation-types';
import type { DeviationFilters } from '@/lib/deviation-types';

interface DeviationFiltersBarProps {
  filters: DeviationFilters;
  onChange: (filters: DeviationFilters) => void;
}

export function DeviationFiltersBar({ filters, onChange }: DeviationFiltersBarProps) {
  const set = (key: keyof DeviationFilters, value: string) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const clear = () => onChange({});

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Advanced Filters</p>
        <Button variant="ghost" size="sm" onClick={clear} className="h-8 gap-1 text-muted-foreground">
          <X className="h-3.5 w-3.5" />Clear
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deviation number, title, product..."
            className="pl-9"
            value={filters.search || ''}
            onChange={(e) => set('search', e.target.value)}
          />
        </div>
        <Input placeholder="Deviation Number" value={filters.deviation_number || ''} onChange={(e) => set('deviation_number', e.target.value)} />
        <Input placeholder="Batch Number" value={filters.batch_number || ''} onChange={(e) => set('batch_number', e.target.value)} />
        <Select value={filters.department || 'all'} onValueChange={(v) => set('department', v === 'all' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Product" value={filters.product_name || ''} onChange={(e) => set('product_name', e.target.value)} />
        <Select value={filters.category || 'all'} onValueChange={(v) => set('category', v === 'all' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {DEVIATION_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.criticality || 'all'} onValueChange={(v) => set('criticality', v === 'all' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Criticality" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Criticality</SelectItem>
            {DEVIATION_CRITICALITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status || 'all'} onValueChange={(v) => set('status', v === 'all' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {DEVIATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" placeholder="From" value={filters.date_from || ''} onChange={(e) => set('date_from', e.target.value)} />
        <Input type="date" placeholder="To" value={filters.date_to || ''} onChange={(e) => set('date_to', e.target.value)} />
        <Input placeholder="Assigned To" value={filters.assigned_to || ''} onChange={(e) => set('assigned_to', e.target.value)} />
        <Select
          value={filters.overdue_only ? 'yes' : 'all'}
          onValueChange={(v) => onChange({ ...filters, overdue_only: v === 'yes' ? true : undefined })}
        >
          <SelectTrigger><SelectValue placeholder="Overdue" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Records</SelectItem>
            <SelectItem value="yes">Overdue Only</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.capa_required === undefined ? 'all' : filters.capa_required ? 'yes' : 'no'}
          onValueChange={(v) => onChange({ ...filters, capa_required: v === 'all' ? undefined : v === 'yes' })}
        >
          <SelectTrigger><SelectValue placeholder="CAPA Required" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">CAPA — All</SelectItem>
            <SelectItem value="yes">CAPA Required</SelectItem>
            <SelectItem value="no">No CAPA</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
