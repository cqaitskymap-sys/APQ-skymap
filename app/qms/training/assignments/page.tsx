'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TmsFiltersBar } from '@/components/training/tms-filters';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { AssignmentForm } from '@/components/training/tms-assignment-form';
import { TrainingMasterForm } from '@/components/training/tms-master-form';
import { useTrainingDashboard, useTmsActor } from '@/hooks/use-training';
import { createAssignment, createTrainingMaster, exportAssignmentsCsv } from '@/lib/training-service';
import type { TmsFilters } from '@/lib/training-types';
import type { AssignmentInput, TrainingMasterInput } from '@/lib/training-schemas';
import { canAssignTraining } from '@/lib/training-types';

export default function TrainingAssignmentsPage() {
  const [filters, setFilters] = useState<TmsFilters>({});
  const [saving, setSaving] = useState(false);
  const [showMaster, setShowMaster] = useState(false);
  const { assignments, loading, error, refresh, role } = useTrainingDashboard(filters);
  const actor = useTmsActor();

  const handleAssign = async (data: AssignmentInput) => {
    setSaving(true);
    try {
      await createAssignment(data, actor);
      toast.success('Training assigned');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMaster = async (data: TrainingMasterInput) => {
    setSaving(true);
    try {
      await createTrainingMaster(data, actor);
      toast.success('Training master created');
      setShowMaster(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Training Assignment</h1>
          <p className="text-muted-foreground text-sm">Assign trainings to employees with due dates and tracking</p>
        </div>
        <Button variant="outline" onClick={() => exportAssignmentsCsv(assignments)}><Download className="h-4 w-4 mr-1" />Export</Button>
      </div>
      <TmsFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}

      {canAssignTraining(role) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card><CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Assign Training</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowMaster(!showMaster)}>
              {showMaster ? 'Hide' : '+ New Training Master'}
            </Button>
          </CardHeader><CardContent>
            <AssignmentForm onSubmit={handleAssign} saving={saving} />
          </CardContent></Card>
          {showMaster && (
            <Card><CardHeader><CardTitle className="text-base">Create Training Master</CardTitle></CardHeader><CardContent>
              <TrainingMasterForm onSubmit={handleCreateMaster} onCancel={() => setShowMaster(false)} saving={saving} submitLabel="Create Training" />
            </CardContent></Card>
          )}
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>All Assignments ({assignments.length})</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Number</TableHead><TableHead>Title</TableHead><TableHead>Employee</TableHead>
            <TableHead>Department</TableHead><TableHead>Assigned</TableHead><TableHead>Due</TableHead>
            <TableHead>Score</TableHead><TableHead>Pass/Fail</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead>
          </TableRow></TableHeader><TableBody>
            {assignments.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No assignments</TableCell></TableRow>
              : assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-sm">{a.training_number}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{a.training_title}</TableCell>
                  <TableCell>{a.employee_name}</TableCell>
                  <TableCell>{a.department}</TableCell>
                  <TableCell>{a.assigned_date}</TableCell>
                  <TableCell>{a.due_date}</TableCell>
                  <TableCell>{a.assessment_score ?? '—'}</TableCell>
                  <TableCell>{a.pass_fail || '—'}</TableCell>
                  <TableCell><TmsStatusBadge status={a.status} /></TableCell>
                  <TableCell className="text-xs capitalize">{a.source?.replace(/_/g, ' ') || 'manual'}</TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
