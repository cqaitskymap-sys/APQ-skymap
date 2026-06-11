'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AreaFiltersBar } from '@/components/monitoring-mgmt/monitoring-filters';
import { AreaForm } from '@/components/monitoring-mgmt/area-form';
import { MonitoringStatusBadge, GradeBadge } from '@/components/monitoring-mgmt/monitoring-sub-nav';
import { useMonitoring, useMonitoringActor } from '@/hooks/use-monitoring-mgmt';
import { createArea, exportAreasCsv } from '@/lib/monitoring-mgmt-service';
import type { AreaFilters } from '@/lib/monitoring-mgmt-types';
import type { AreaCreateInput } from '@/lib/monitoring-mgmt-schemas';
import { canManageMonitoring } from '@/lib/monitoring-mgmt-types';

export default function AreaMasterPage() {
  const [filters, setFilters] = useState<AreaFilters>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { areas, loading, error, refresh } = useMonitoring(filters);
  const actor = useMonitoringActor();

  const handleCreate = async (data: AreaCreateInput) => {
    setSaving(true);
    try {
      await createArea(data, actor);
      toast.success('Area created');
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Area Master</h1>
          <p className="text-muted-foreground text-sm">Define cleanroom areas with monitoring limits and grades</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportAreasCsv(areas)}>Export CSV</Button>
          {canManageMonitoring(actor.role) && (
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New Area</Button>
          )}
        </div>
      </div>
      <AreaFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>All Areas ({areas.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Grade</TableHead>
              <TableHead>Department</TableHead><TableHead>Room</TableHead><TableHead>Process</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {areas.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No areas — create your first area</TableCell></TableRow>
                : areas.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.area_code}</TableCell>
                    <TableCell>{a.area_name}</TableCell>
                    <TableCell><GradeBadge grade={a.cleanroom_grade} /></TableCell>
                    <TableCell>{a.department}</TableCell>
                    <TableCell>{a.room_number || '—'}</TableCell>
                    <TableCell className="max-w-[120px] truncate">{a.process_area || '—'}</TableCell>
                    <TableCell><MonitoringStatusBadge status={a.area_status} /></TableCell>
                    <TableCell><Link href={`/qms/monitoring/${a.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>Create Area</SheetTitle></SheetHeader>
          <div className="mt-6"><AreaForm onSubmit={handleCreate} onCancel={() => setOpen(false)} saving={saving} submitLabel="Create Area" /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
