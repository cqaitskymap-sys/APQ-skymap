'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertCircle, CheckCircle } from 'lucide-react';

const mockEquipment = [
  { id: '1', equipment_id: 'FIL-001', name: 'Filling Machine A', status: 'qualified', next_calibration: '2024-03-15', next_pm: '2024-02-28' },
  { id: '2', equipment_id: 'AUT-001', name: 'Autoclave Unit 1', status: 'qualified', next_calibration: '2024-04-20', next_pm: '2024-03-10' },
  { id: '3', equipment_id: 'CENT-001', name: 'Centrifuge Model X', status: 'pending_qualification', next_calibration: null, next_pm: null },
  { id: '4', equipment_id: 'SPEC-001', name: 'UV Spectrophotometer', status: 'qualified', next_calibration: '2024-02-10', next_pm: null },
];

export default function EquipmentPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipment Qualification</h1>
          <p className="text-muted-foreground">IQ/OQ/PQ qualification and maintenance schedules</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-500"><Plus className="h-4 w-4 mr-2" />Register Equipment</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Total Equipment</p><p className="text-3xl font-bold">{mockEquipment.length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Qualified</p><p className="text-3xl font-bold">{mockEquipment.filter(e => e.status === 'qualified').length}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Calibration Due</p><p className="text-3xl font-bold">2</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-muted-foreground mb-1">Maintenance Due</p><p className="text-3xl font-bold">3</p></CardContent></Card>
      </div>

      <div className="space-y-3">
        {mockEquipment.map(eq => (
          <Card key={eq.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-semibold text-sm">{eq.equipment_id}</p>
                  <h3 className="font-semibold">{eq.name}</h3>
                </div>
                <Badge variant="outline">{eq.status === 'qualified' ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}{eq.status.replace('_', ' ')}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
