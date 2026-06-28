'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';
import { TMS_DEPARTMENTS } from '@/lib/training-types';
import {
  TRAINING_DASHBOARD_TYPES, TRAINING_DASHBOARD_STATUSES, TRAINING_MODES_FILTER,
  type TrainingDashboardFilters,
} from '@/lib/training-dashboard-types';
import type { EmployeeProfile } from '@/lib/training-types';

interface TrainingDashboardFiltersBarProps {
  filters: TrainingDashboardFilters;
  onChange: (f: TrainingDashboardFilters) => void;
  employees?: EmployeeProfile[];
  trainers?: string[];
  designations?: string[];
  showEmployeeFilter?: boolean;
  showDepartmentFilter?: boolean;
}

export function TrainingDashboardFiltersBar({
  filters,
  onChange,
  employees = [],
  trainers = [],
  designations = [],
  showEmployeeFilter = true,
  showDepartmentFilter = true,
}: TrainingDashboardFiltersBarProps) {
  const update = (key: keyof TrainingDashboardFilters, value: string) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const hasFilters = Boolean(
    filters.search || filters.department || filters.training_type
    || filters.employee_id || filters.date_from || filters.date_to
    || filters.status || filters.trainer || filters.training_mode || filters.designation,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Advanced Filters</CardTitle>
        <CardDescription>Filter dashboard by department, employee, status, trainer, and date range.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Label>Global Search</Label>
          <Input placeholder="Search employee, training no, topic…" value={filters.search || ''} onChange={(e) => update('search', e.target.value)} />
        </div>
        {showDepartmentFilter && (
          <div><Label>Department</Label>
            <Select value={filters.department || 'all'} onValueChange={(v) => update('department', v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {showEmployeeFilter && employees.length > 0 && (
          <div><Label>Employee</Label>
            <Select value={filters.employee_id || 'all'} onValueChange={(v) => update('employee_id', v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {designations.length > 0 && (
          <div><Label>Designation</Label>
            <Select value={filters.designation || 'all'} onValueChange={(v) => update('designation', v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {designations.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div><Label>Training Type</Label>
          <Select value={filters.training_type || 'all'} onValueChange={(v) => update('training_type', v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TRAINING_DASHBOARD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Status</Label>
          <Select value={filters.status || 'all'} onValueChange={(v) => update('status', v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {TRAINING_DASHBOARD_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Trainer</Label>
          <Select value={filters.trainer || 'all'} onValueChange={(v) => update('trainer', v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trainers</SelectItem>
              {trainers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Training Mode</Label>
          <Select value={filters.training_mode || 'all'} onValueChange={(v) => update('training_mode', v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              {TRAINING_MODES_FILTER.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Date From</Label><Input type="date" value={filters.date_from || ''} onChange={(e) => update('date_from', e.target.value)} /></div>
        <div><Label>Date To</Label><Input type="date" value={filters.date_to || ''} onChange={(e) => update('date_to', e.target.value)} /></div>
        {hasFilters && (
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={() => onChange({})}><X className="h-4 w-4 mr-1" />Clear</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
