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
import { CsvFiltersBar } from '@/components/csv-mgmt/csv-filters';
import { SystemForm } from '@/components/csv-mgmt/system-form';
import { CsvStatusBadge, GxpBadge } from '@/components/csv-mgmt/csv-sub-nav';
import { useCsvSystems, useCsvActor } from '@/hooks/use-csv-mgmt';
import { createSystem, exportSystemsCsv } from '@/lib/csv-mgmt-service';
import type { CsvFilters } from '@/lib/csv-mgmt-types';
import type { SystemCreateInput } from '@/lib/csv-mgmt-schemas';
import { canManageCsv } from '@/lib/csv-mgmt-types';

export default function SystemsPage() {
  const [filters, setFilters] = useState<CsvFilters>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { systems, loading, error, refresh } = useCsvSystems(filters);
  const actor = useCsvActor();

  const handleCreate = async (data: SystemCreateInput) => {
    setSaving(true);
    try {
      await createSystem(data, actor);
      toast.success('System registered');
      setOpen(false);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">System Inventory</h1>
          <p className="text-muted-foreground text-sm">GxP computerized systems and software inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportSystemsCsv(systems)}>Export</Button>
          {canManageCsv(actor.role) && (
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Register System</Button>
          )}
        </div>
      </div>
      <CsvFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>All Systems ({systems.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>System ID</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead>
              <TableHead>Department</TableHead><TableHead>Hosting</TableHead><TableHead>GxP</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {systems.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.system_id}</TableCell>
                  <TableCell>{s.system_name}</TableCell><TableCell className="text-xs">{s.system_type}</TableCell>
                  <TableCell>{s.department}</TableCell><TableCell>{s.hosting_type}</TableCell>
                  <TableCell><GxpBadge critical={s.gxp_impact} /></TableCell>
                  <TableCell><CsvStatusBadge status={s.validation_status} /></TableCell>
                  <TableCell><Link href={`/qms/csv/${s.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                </TableRow>
              ))}
            </TableBody></Table>
          </CardContent></Card>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>Register System</SheetTitle></SheetHeader>
          <div className="mt-6"><SystemForm onSubmit={handleCreate} onCancel={() => setOpen(false)} saving={saving} submitLabel="Register System" /></div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
