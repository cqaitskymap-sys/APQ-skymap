'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ValidationFiltersBar } from '@/components/validation-mgmt/validation-filters';
import { ValidationForm } from '@/components/validation-mgmt/validation-form';
import { ValidationStatusBadge } from '@/components/validation-mgmt/validation-sub-nav';
import { useValidations, useValidationActor } from '@/hooks/use-validation-mgmt';
import { createValidation, exportValidationsCsv } from '@/lib/validation-mgmt-service';
import type { ValidationFilters } from '@/lib/validation-mgmt-types';
import type { ValidationCreateInput } from '@/lib/validation-mgmt-schemas';
import { canManageValidation } from '@/lib/validation-mgmt-types';

interface ValidationListPageProps {
  title: string;
  description: string;
  validationType?: string;
  isVmp?: boolean;
  defaultFormValues?: Partial<ValidationCreateInput>;
}

export function ValidationListPage({ title, description, validationType, isVmp, defaultFormValues }: ValidationListPageProps) {
  const baseFilters: ValidationFilters = {
    ...(validationType ? { validation_type: validationType } : {}),
    ...(isVmp ? { is_vmp: true } : {}),
  };
  const [extraFilters, setExtraFilters] = useState<ValidationFilters>({});
  const filters = { ...baseFilters, ...extraFilters };
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { records, loading, error, refresh } = useValidations(filters);
  const actor = useValidationActor();

  const handleCreate = async (data: ValidationCreateInput) => {
    setSaving(true);
    try {
      await createValidation({
        ...data,
        ...(validationType ? { validation_type: validationType as ValidationCreateInput['validation_type'] } : {}),
        ...(isVmp ? { is_vmp: true, vmp_year: String(new Date().getFullYear()) } : {}),
      }, actor);
      toast.success('Validation record created');
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportValidationsCsv(records)}><Download className="h-4 w-4 mr-1" />Export</Button>
          {canManageValidation(actor.role) && (
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New Record</Button>
          )}
        </div>
      </div>
      <ValidationFiltersBar filters={extraFilters} onChange={setExtraFilters} hideType={!!validationType} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <LoadingSpinner /> : (
        <Card><CardHeader><CardTitle>Records ({records.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Title</TableHead>{!validationType && <TableHead>Type</TableHead>}
              <TableHead>Department</TableHead><TableHead>Equipment/System</TableHead><TableHead>Status</TableHead><TableHead>Deviation</TableHead><TableHead></TableHead>
            </TableRow></TableHeader><TableBody>
              {records.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No validation records</TableCell></TableRow>
                : records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.validation_number}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{r.validation_title}</TableCell>
                    {!validationType && <TableCell className="text-xs">{r.validation_type}</TableCell>}
                    <TableCell>{r.department}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs">{r.equipment_name || r.system_name || '—'}</TableCell>
                    <TableCell><ValidationStatusBadge status={r.validation_status} /></TableCell>
                    <TableCell>{r.deviation_observed ? 'Yes' : 'No'}</TableCell>
                    <TableCell><Link href={`/qms/validation/${r.id}`}><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody></Table>
          </CardContent></Card>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>Create {title}</SheetTitle></SheetHeader>
          <div className="mt-6">
            <ValidationForm
              lockType={validationType}
              defaultValues={{ ...defaultFormValues, ...(isVmp ? { is_vmp: true } : {}) }}
              onSubmit={handleCreate}
              onCancel={() => setOpen(false)}
              saving={saving}
              submitLabel="Create Validation"
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
