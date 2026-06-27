'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { TMS_DEPARTMENTS } from '@/lib/training-types';
import { TRAINING_DASHBOARD_TYPES } from '@/lib/training-dashboard-records';
import type { TrainingDashboardFilters } from '@/lib/training-dashboard-records';
import type { EmployeeProfile } from '@/lib/training-types';

interface TrainingDashboardFiltersBarProps {
  filters: TrainingDashboardFilters;
  onChange: (f: TrainingDashboardFilters) => void;
  employees?: EmployeeProfile[];
  showEmployeeFilter?: boolean;
  showDepartmentFilter?: boolean;
}

export function TrainingDashboardFiltersBar({
  filters,
  onChange,
  employees = [],
  showEmployeeFilter = true,
  showDepartmentFilter = true,
}: TrainingDashboardFiltersBarProps) {
  const update = (key: keyof TrainingDashboardFilters, value: string) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const hasFilters = Boolean(
    filters.search || filters.department || filters.training_type
    || filters.employee_id || filters.date_from || filters.date_to,
  );

  return (
    <div className="flex flex-wrap gap-2 items-center rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <Input
        placeholder="Search employee or training no…"
        className="w-full sm:w-56"
        value={filters.search || ''}
        onChange={(e) => update('search', e.target.value)}
      />
      {showDepartmentFilter && (
        <Select value={filters.department || 'all'} onValueChange={(v) => update('department', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Select value={filters.training_type || 'all'} onValueChange={(v) => update('training_type', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Training Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {TRAINING_DASHBOARD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      {showEmployeeFilter && employees.length > 0 && (
        <Select value={filters.employee_id || 'all'} onValueChange={(v) => update('employee_id', v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Employee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.employee_id}>{e.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Input
        type="date"
        className="w-[150px]"
        value={filters.date_from || ''}
        onChange={(e) => update('date_from', e.target.value)}
        title="Date from"
      />
      <Input
        type="date"
        className="w-[150px]"
        value={filters.date_to || ''}
        onChange={(e) => update('date_to', e.target.value)}
        title="Date to"
      />
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          <X className="h-4 w-4 mr-1" />Clear
        </Button>
      )}
    </div>
  );
}
