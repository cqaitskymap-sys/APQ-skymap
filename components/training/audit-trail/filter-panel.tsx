'use client';

import { Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TRAINING_AUDIT_ACTION_TYPES, TRAINING_AUDIT_MODULES, TRAINING_ENTITY_TYPES,
  type TrainingAuditFilters,
} from '@/lib/training-audit-trail-records';
import { TMS_DEPARTMENTS } from '@/lib/training-types';

interface FilterPanelProps {
  filters: TrainingAuditFilters;
  users: { id: string; name: string }[];
  onChange: (filters: TrainingAuditFilters) => void;
  onPageReset?: () => void;
}

export function FilterPanel({ filters, users, onChange, onPageReset }: FilterPanelProps) {
  const set = (patch: Partial<TrainingAuditFilters>) => {
    onChange({ ...filters, ...patch });
    onPageReset?.();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Advanced Filters</CardTitle>
        <CardDescription>Search and filter immutable audit logs. Records cannot be edited or deleted.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1 sm:col-span-2 lg:col-span-3">
          <Label>Search</Label>
          <div className="relative max-w-lg">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Actions, users, fields, values, references…"
              value={filters.search ?? ''}
              onChange={(e) => set({ search: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Module</Label>
          <Select value={filters.module ?? 'all'} onValueChange={(v) => set({ module: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="All Modules" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {TRAINING_AUDIT_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Action</Label>
          <Select value={filters.action ?? 'all'} onValueChange={(v) => set({ action: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="All Actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {TRAINING_AUDIT_ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Entity Type</Label>
          <Select value={filters.entity_type ?? 'all'} onValueChange={(v) => set({ entity_type: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="All Entities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {TRAINING_ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>User</Label>
          <Select value={filters.user_id ?? 'all'} onValueChange={(v) => set({ user_id: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="All Users" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Department</Label>
          <Select value={filters.department ?? 'all'} onValueChange={(v) => set({ department: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Reference Number</Label>
          <Input placeholder="TRN-…" value={filters.reference_number ?? ''} onChange={(e) => set({ reference_number: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>E-Signature Status</Label>
          <Select value={filters.e_signature_status ?? 'all'} onValueChange={(v) => set({ e_signature_status: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="required">Required</SelectItem>
              <SelectItem value="signed">Signed</SelectItem>
              <SelectItem value="none">Not Required</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>From Date</Label>
          <Input type="date" value={filters.start_date ?? ''} onChange={(e) => set({ start_date: e.target.value || undefined })} />
        </div>
        <div className="space-y-1">
          <Label>To Date</Label>
          <Input type="date" value={filters.end_date ?? ''} onChange={(e) => set({ end_date: e.target.value || undefined })} />
        </div>
      </CardContent>
    </Card>
  );
}
