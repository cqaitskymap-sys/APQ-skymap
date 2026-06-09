'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, AlertCircle } from 'lucide-react';

const mockStabilityStudies = [
  { id: '1', study_number: 'STAB-2024-001', product: 'Amikacin 100mg', batch: 'BTH-2024-045', study_type: 'long_term', start_date: '2024-01-01', next_test: '2024-04-01', status: 'ongoing', progress: 25 },
  { id: '2', study_number: 'STAB-2024-002', product: 'Meropenem 500mg', batch: 'BTH-2024-043', study_type: 'accelerated', start_date: '2024-01-15', next_test: '2024-02-15', status: 'ongoing', progress: 60 },
  { id: '3', study_number: 'STAB-2023-045', product: 'Vancomycin 500mg', batch: 'BTH-2023-089', study_type: 'long_term', start_date: '2023-01-10', next_test: null, status: 'completed', progress: 100 },
];

export default function StabilityPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stability Studies</h1>
          <p className="text-muted-foreground">Long-term, accelerated, and stress stability testing</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />New Study</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Ongoing Studies</p>
            <p className="text-3xl font-bold">{mockStabilityStudies.filter(s => s.status === 'ongoing').length}</p>
            <p className="text-xs text-blue-600 mt-2">Active investigations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Due for Testing</p>
            <p className="text-3xl font-bold">3</p>
            <p className="text-xs text-amber-600 mt-2">In next 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Completed</p>
            <p className="text-3xl font-bold">{mockStabilityStudies.filter(s => s.status === 'completed').length}</p>
            <p className="text-xs text-green-600 mt-2">YTD</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {mockStabilityStudies.map(study => (
          <Card key={study.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono font-semibold text-sm">{study.study_number}</p>
                  <h3 className="font-semibold text-base">{study.product}</h3>
                </div>
                <Badge variant="outline">{study.study_type}</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{study.progress}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${study.progress}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
                <span>Started: {new Date(study.start_date).toLocaleDateString()}</span>
                {study.next_test && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Next: {new Date(study.next_test).toLocaleDateString()}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
