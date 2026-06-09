'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, CheckCircle } from 'lucide-react';

const mockTraining = [
  { id: '1', training_id: 'TRN-2024-001', title: 'GMP Fundamentals', type: 'gmp', trainer: 'Dr. Smith', participants: 24, completion_rate: 100, next_due: '2025-01-15' },
  { id: '2', training_id: 'TRN-2024-002', title: 'SOP for Batch Recording', type: 'sop', trainer: 'Dr. Johnson', participants: 18, completion_rate: 94, next_due: '2025-02-20' },
  { id: '3', training_id: 'TRN-2024-003', title: 'Laboratory Safety', type: 'safety', trainer: 'Safety Officer', participants: 32, completion_rate: 88, next_due: '2024-12-15' },
];

export default function TrainingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Training Management</h1>
          <p className="text-muted-foreground">GMP training records and certifications</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />Schedule Training</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total Trainings</p><p className="text-3xl font-bold">{mockTraining.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total Participants</p><p className="text-3xl font-bold">{mockTraining.reduce((sum, t) => sum + t.participants, 0)}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Avg Completion</p><p className="text-3xl font-bold">94%</p></CardContent></Card>
      </div>

      <div className="space-y-3">
        {mockTraining.map(training => (
          <Card key={training.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-sm">{training.training_id}</p>
                  <h3 className="font-semibold">{training.title}</h3>
                  <p className="text-sm text-muted-foreground">Trainer: {training.trainer}</p>
                </div>
                <Badge variant="outline">{training.type}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-3 border-t text-sm">
                <div className="flex items-center gap-1"><Users className="h-4 w-4" />{training.participants} participants</div>
                <div className="flex items-center gap-1"><CheckCircle className="h-4 w-4" />{training.completion_rate}% complete</div>
                <div>Next Due: {new Date(training.next_due).toLocaleDateString()}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
