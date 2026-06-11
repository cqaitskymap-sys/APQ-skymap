'use client';

import { Download, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EquipmentDashboardCharts } from '@/components/equipment-mgmt/equipment-dashboard-charts';
import { EquipmentPdfDocument } from '@/components/equipment-mgmt/equipment-pdf-document';
import { useEquipment } from '@/hooks/use-equipment-mgmt';
import { exportEquipmentCsv, exportCalibrationsCsv } from '@/lib/equipment-mgmt-service';
import { printPage } from '@/lib/export-utils';

const REPORTS = [
  { title: 'Equipment Master Register', desc: 'Complete equipment inventory with status and due dates' },
  { title: 'Calibration Schedule', desc: 'Upcoming calibration due dates across departments' },
  { title: 'Calibration Certificate Register', desc: 'All calibration records with agency and status' },
  { title: 'PM Schedule', desc: 'Preventive maintenance due dates and completion status' },
  { title: 'Breakdown Report', desc: 'Equipment breakdown history with downtime analysis' },
  { title: 'Equipment Status Report', desc: 'Current availability and blocking status register' },
];

export default function EquipmentReportsPage() {
  const { equipment, calibrations, pmRecords, breakdowns, metrics, loading } = useEquipment({});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Equipment Reports</h1>
          <p className="text-muted-foreground text-sm">Registers, analytics, and GMP compliance exports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportEquipmentCsv(equipment)}><Download className="h-4 w-4 mr-1" />Equipment CSV</Button>
          <Button variant="outline" onClick={() => exportCalibrationsCsv(calibrations)}><Download className="h-4 w-4 mr-1" />Calibration CSV</Button>
          <Button variant="outline" onClick={printPage}><Printer className="h-4 w-4 mr-1" />Print PDF</Button>
        </div>
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries({
                'Total Equipment': metrics.total, 'Active': metrics.active,
                'Cal Overdue': metrics.calibrationOverdue, 'Availability': `${metrics.availabilityPercent}%`,
              }).map(([k, v]) => (
                <Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>
              ))}
            </div>
          )}
          <EquipmentDashboardCharts equipment={equipment} breakdowns={breakdowns} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORTS.map((r) => (
              <Card key={r.title}><CardHeader><CardTitle className="text-sm">{r.title}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground"><p>{r.desc}</p></CardContent></Card>
            ))}
          </div>
          <div className="hidden print:block">
            <EquipmentPdfDocument equipment={equipment} calibrations={calibrations} pmRecords={pmRecords} breakdowns={breakdowns} reportTitle="Equipment Management Report" />
          </div>
        </>
      )}
    </div>
  );
}
