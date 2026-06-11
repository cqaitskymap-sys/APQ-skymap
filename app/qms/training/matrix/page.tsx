'use client';

import { Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ComplianceBadge } from '@/components/training/tms-sub-nav';
import { useTrainingMatrix } from '@/hooks/use-training';
import { exportMatrixCsv } from '@/lib/training-service';

export default function TrainingMatrixPage() {
  const { matrix, loading, refresh } = useTrainingMatrix();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Employee Training Matrix</h1>
          <p className="text-muted-foreground text-sm">Required, completed, pending, and overdue trainings by employee</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" />Refresh Matrix</Button>
          <Button variant="outline" onClick={() => exportMatrixCsv(matrix)}><Download className="h-4 w-4 mr-1" />Export</Button>
        </div>
      </div>
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="overflow-x-auto p-0">
          <Table><TableHeader><TableRow>
            <TableHead>Employee ID</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead>
            <TableHead>Designation</TableHead><TableHead>Required</TableHead><TableHead>Completed</TableHead>
            <TableHead>Pending</TableHead><TableHead>Overdue</TableHead><TableHead>Compliance</TableHead>
          </TableRow></TableHeader><TableBody>
            {matrix.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No employee data — add users in Admin</TableCell></TableRow>
              : matrix.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-sm">{m.employee_id}</TableCell>
                  <TableCell className="font-medium">{m.employee_name}</TableCell>
                  <TableCell>{m.department}</TableCell>
                  <TableCell>{m.designation || '—'}</TableCell>
                  <TableCell>{m.required_trainings.length}</TableCell>
                  <TableCell className="text-green-700">{m.completed_trainings.length}</TableCell>
                  <TableCell className="text-amber-700">{m.pending_trainings.length}</TableCell>
                  <TableCell className="text-red-700">{m.overdue_trainings.length}</TableCell>
                  <TableCell><ComplianceBadge percent={m.compliance_percent} /></TableCell>
                </TableRow>
              ))}
          </TableBody></Table>
        </CardContent></Card>
      )}
    </div>
  );
}
