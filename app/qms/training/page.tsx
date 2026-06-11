'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users, GraduationCap, Clock, AlertTriangle, CheckCircle, XCircle, RefreshCw, Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TmsDashboardCharts } from '@/components/training/tms-dashboard-charts';
import { TmsFiltersBar } from '@/components/training/tms-filters';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { useTrainingDashboard } from '@/hooks/use-training';
import { exportAssignmentsCsv } from '@/lib/training-service';
import type { TmsFilters } from '@/lib/training-types';
import { cn } from '@/lib/utils';

export default function TrainingDashboardPage() {
  const [filters, setFilters] = useState<TmsFilters>({});
  const { assignments, matrix, competency, metrics, loading, error } = useTrainingDashboard(filters);

  const kpiCards = metrics ? [
    { label: 'Total Employees', value: metrics.totalEmployees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Training Compliance %', value: `${metrics.compliancePercent}%`, icon: GraduationCap, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pending Trainings', value: metrics.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Overdue Trainings', value: metrics.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Effective Trainings', value: metrics.effective, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Failed Assessments', value: metrics.failedAssessments, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Retraining Required', value: metrics.retrainingRequired, icon: RefreshCw, color: 'text-purple-600', bg: 'bg-purple-50' },
  ] : [];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Training Dashboard</h1>
          <p className="text-muted-foreground text-sm">GMP-compliant employee training management integrated with DMS, CAPA, and Change Control</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportAssignmentsCsv(assignments)}><Download className="h-4 w-4" />Export</Button>
          <Link href="/qms/training/assignments"><Button className="bg-blue-600 hover:bg-blue-700">Assign Training</Button></Link>
        </div>
      </div>
      <TmsFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {kpiCards.map((s) => { const Icon = s.icon; return (
              <Card key={s.label} className="hover:shadow-md transition-shadow"><CardContent className="p-4">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', s.bg)}><Icon className={cn('h-4 w-4', s.color)} /></div>
                <p className="text-xs text-muted-foreground">{s.label}</p><p className="text-2xl font-bold">{s.value}</p>
              </CardContent></Card>
            ); })}
          </div>
          <TmsDashboardCharts matrix={matrix} assignments={assignments} competency={competency} />
          <Card><CardHeader><CardTitle>Recent Assignments</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Training</TableHead><TableHead>Employee</TableHead>
              <TableHead>Department</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader><TableBody>
              {assignments.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No assignments found</TableCell></TableRow>
                : assignments.slice(0, 10).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.training_number}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{a.training_title}</TableCell>
                    <TableCell>{a.employee_name}</TableCell>
                    <TableCell>{a.department}</TableCell>
                    <TableCell>{a.due_date}</TableCell>
                    <TableCell><TmsStatusBadge status={a.status} /></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
