'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TRAINING_REPORT_TYPES, type TrainingReportFilters,
} from '@/lib/training-reports-records';
import { TMS_DEPARTMENTS, TRAINING_TYPES } from '@/lib/training-types';

interface ReportFilterProps {
  filters: TrainingReportFilters;
  onChange: (filters: TrainingReportFilters) => void;
  employees?: { id: string; name: string }[];
  trainers?: string[];
}

export function ReportFilter({ filters, onChange, employees = [], trainers = [] }: ReportFilterProps) {
  const set = (patch: Partial<TrainingReportFilters>) => onChange({ ...filters, ...patch });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Report Filters</CardTitle>
        <CardDescription>Filter live Firestore training data for report generation.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1 sm:col-span-2 lg:col-span-3">
          <Label>Search</Label>
          <Input placeholder="Employee, training, reference…" value={filters.search ?? ''} onChange={(e) => set({ search: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Report Type</Label>
          <Select value={filters.report_type ?? TRAINING_REPORT_TYPES[0]} onValueChange={(v) => set({ report_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRAINING_REPORT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Department</Label>
          <Select value={filters.department ?? 'all'} onValueChange={(v) => set({ department: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Employee</Label>
          <Select value={filters.employee_id ?? 'all'} onValueChange={(v) => set({ employee_id: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Training Type</Label>
          <Select value={filters.training_type ?? 'all'} onValueChange={(v) => set({ training_type: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Trainer</Label>
          <Select value={filters.trainer ?? 'all'} onValueChange={(v) => set({ trainer: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Trainers</SelectItem>
              {trainers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={filters.status ?? 'all'} onValueChange={(v) => set({ status: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {['pending', 'in_progress', 'completed', 'overdue', 'retraining', 'cancelled'].map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Assessment Result</Label>
          <Select value={filters.assessment_result ?? 'all'} onValueChange={(v) => set({ assessment_result: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Pass">Pass</SelectItem>
              <SelectItem value="Fail">Fail</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Certificate Status</Label>
          <Select value={filters.certificate_status ?? 'all'} onValueChange={(v) => set({ certificate_status: v === 'all' ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>From Date</Label>
          <Input type="date" value={filters.date_from ?? ''} onChange={(e) => set({ date_from: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>To Date</Label>
          <Input type="date" value={filters.date_to ?? ''} onChange={(e) => set({ date_to: e.target.value })} />
        </div>
      </CardContent>
    </Card>
  );
}
