'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { AUDIT_TYPES, AUDIT_DEPARTMENTS, AUDIT_STATUSES } from '@/lib/audit-mgmt-types';
import type { AuditFilters } from '@/lib/audit-mgmt-types';

export function AuditFiltersBar({ filters, onChange }: { filters: AuditFilters; onChange: (f: AuditFilters) => void }) {
  const update = (key: keyof AuditFilters, value: string) => onChange({ ...filters, [key]: value || undefined });

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input placeholder="Search number, title…" className="w-full sm:w-56" value={filters.search || ''} onChange={(e) => update('search', e.target.value)} />
      <Select value={filters.status || 'all'} onValueChange={(v) => update('status', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {AUDIT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.audit_type || 'all'} onValueChange={(v) => update('audit_type', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {AUDIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.department || 'all'} onValueChange={(v) => update('department', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Department" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {AUDIT_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
        </SelectContent>
      </Select>
      {(filters.search || filters.status || filters.audit_type || filters.department) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}><X className="h-4 w-4 mr-1" />Clear</Button>
      )}
    </div>
  );
}
