'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { useTrainingDashboard } from '@/hooks/use-training';

export default function TrainingSchedulePage() {
  const { assignments, loading } = useTrainingDashboard({ status: 'pending' });
  const scheduled = assignments.filter((a) => ['pending', 'in_progress', 'overdue'].includes(a.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Training Schedule</h1>
        <p className="text-muted-foreground text-sm">Upcoming and scheduled training sessions</p>
      </div>
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>Scheduled Trainings ({scheduled.length})</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Number</TableHead><TableHead>Training</TableHead><TableHead>Employee</TableHead>
            <TableHead>Department</TableHead><TableHead>Trainer</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader><TableBody>
            {scheduled.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No scheduled trainings</TableCell></TableRow>
              : scheduled.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-sm">{a.training_number}</TableCell>
                  <TableCell>{a.training_title}</TableCell>
                  <TableCell>{a.employee_name}</TableCell>
                  <TableCell>{a.department}</TableCell>
                  <TableCell>{a.trainer_name}</TableCell>
                  <TableCell>{a.due_date}</TableCell>
                  <TableCell><TmsStatusBadge status={a.status} /></TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
