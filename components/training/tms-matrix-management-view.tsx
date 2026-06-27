'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Download, Upload, RefreshCw, Plus, Eye, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TmsFiltersBar } from '@/components/training/tms-filters';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { ComplianceBadge, TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { useTrainingMatrixManagement } from '@/hooks/use-training';
import {
  createMatrixDefinition, updateMatrixDefinition, exportMatrixDefinitionsCsv,
  assignFromMatrixDefinitions, processRefresherAssignments, exportMatrixCsv,
} from '@/lib/training-service';
import { matrixDefinitionSchema, type MatrixDefinitionInput } from '@/lib/training-schemas';
import {
  TRAINING_TYPES, TMS_DEPARTMENTS, MATRIX_FREQUENCIES, MATRIX_STATUSES,
  type TmsFilters, type TrainingMatrixDefinition,
  canManageMatrix, canEditMatrix, canViewMatrix, isTmsReadOnly,
} from '@/lib/training-types';
import type { TmsActor } from '@/lib/training-types';

type TabKey = 'definitions' | 'compliance';

const DEFAULT_FORM: MatrixDefinitionInput = {
  department: TMS_DEPARTMENTS[0],
  designation: '',
  role: '',
  training_topic: '',
  training_type: 'GMP Training',
  document_number: '',
  document_title: '',
  sop_number: '',
  sop_version: '',
  training_required: true,
  training_frequency: 'Yearly',
  initial_training_required: true,
  refresher_required: true,
  effectiveness_required: false,
  trainer_role: 'QA Trainer',
  training_duration: '',
  due_days_after_assignment: 30,
  status: 'Active',
  skill: '',
};

export function TrainingMatrixManagementView() {
  const [filters, setFilters] = useState<TmsFilters>({ status: 'Active' });
  const [tab, setTab] = useState<TabKey>('definitions');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<TrainingMatrixDefinition | null>(null);
  const [viewing, setViewing] = useState<TrainingMatrixDefinition | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'department' | 'designation' | 'sop'>('all');

  const { definitions, compliance, loading, error, refresh, role, actor } = useTrainingMatrixManagement(filters);

  const form = useForm<MatrixDefinitionInput>({
    resolver: zodResolver(matrixDefinitionSchema),
    defaultValues: DEFAULT_FORM,
  });

  const grouped = useMemo(() => {
    if (viewMode === 'department') {
      const map: Record<string, TrainingMatrixDefinition[]> = {};
      for (const d of definitions) {
        if (!map[d.department]) map[d.department] = [];
        map[d.department].push(d);
      }
      return map;
    }
    if (viewMode === 'designation') {
      const map: Record<string, TrainingMatrixDefinition[]> = {};
      for (const d of definitions) {
        const key = `${d.department} / ${d.designation}`;
        if (!map[key]) map[key] = [];
        map[key].push(d);
      }
      return map;
    }
    if (viewMode === 'sop') {
      const map: Record<string, TrainingMatrixDefinition[]> = {};
      for (const d of definitions) {
        const key = d.sop_number || d.document_number || 'No Document';
        if (!map[key]) map[key] = [];
        map[key].push(d);
      }
      return map;
    }
    return null;
  }, [definitions, viewMode]);

  if (!canViewMatrix(role)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
        You do not have permission to view the Training Matrix.
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    form.reset(DEFAULT_FORM);
    setShowForm(true);
  };

  const openEdit = (def: TrainingMatrixDefinition) => {
    setEditing(def);
    form.reset({
      department: def.department,
      designation: def.designation,
      role: def.role,
      training_topic: def.training_topic,
      training_type: def.training_type,
      document_number: def.document_number,
      document_title: def.document_title,
      sop_number: def.sop_number,
      sop_version: def.sop_version,
      training_required: def.training_required,
      training_frequency: def.training_frequency,
      initial_training_required: def.initial_training_required,
      refresher_required: def.refresher_required,
      effectiveness_required: def.effectiveness_required,
      trainer_role: def.trainer_role,
      training_duration: def.training_duration,
      due_days_after_assignment: def.due_days_after_assignment,
      status: def.status as 'Active' | 'Inactive',
      skill: def.skill,
    });
    setShowForm(true);
  };

  const handleSubmit = async (data: MatrixDefinitionInput) => {
    setSaving(true);
    try {
      if (editing) {
        await updateMatrixDefinition(editing.id, data, actor as TmsActor);
        toast.success('Matrix updated');
      } else {
        await createMatrixDefinition(data, actor as TmsActor);
        toast.success('Matrix created');
      }
      setShowForm(false);
      setEditing(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoAssign = async () => {
    setSaving(true);
    try {
      const count = await assignFromMatrixDefinitions(actor as TmsActor);
      toast.success(count > 0 ? `${count} training(s) auto-assigned` : 'No new assignments needed');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auto-assign failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresher = async () => {
    setSaving(true);
    try {
      const count = await processRefresherAssignments(actor as TmsActor);
      toast.success(count > 0 ? `${count} refresher assignment(s) created` : 'No refreshers due');
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresher process failed');
    } finally {
      setSaving(false);
    }
  };

  const readOnly = isTmsReadOnly(role);
  const canEdit = canEditMatrix(role) && !readOnly;

  const renderDefinitionTable = (items: TrainingMatrixDefinition[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead>Designation</TableHead>
          <TableHead>Topic</TableHead><TableHead>Type</TableHead><TableHead>Document</TableHead>
          <TableHead>SOP</TableHead><TableHead>Frequency</TableHead><TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No matrix definitions</TableCell></TableRow>
        ) : items.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="font-mono text-sm">{d.matrix_code}</TableCell>
            <TableCell>{d.department}</TableCell>
            <TableCell>{d.designation}</TableCell>
            <TableCell className="max-w-[140px] truncate">{d.training_topic}</TableCell>
            <TableCell className="text-xs">{d.training_type}</TableCell>
            <TableCell className="font-mono text-xs">{d.document_number || '—'}</TableCell>
            <TableCell className="font-mono text-xs">{d.sop_number || '—'}</TableCell>
            <TableCell className="text-xs">{d.training_frequency}</TableCell>
            <TableCell><TmsStatusBadge status={d.status} /></TableCell>
            <TableCell className="text-right space-x-1">
              <Button variant="ghost" size="sm" onClick={() => setViewing(d)}><Eye className="h-4 w-4" /></Button>
              {canEdit && <Button variant="ghost" size="sm" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Matrix Management"
        description="Define role-wise GMP training requirements and automate assignments"
        trail={[{ label: 'Training Matrix' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportMatrixDefinitionsCsv(definitions)}>
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
            <Button variant="outline" size="sm" disabled title="Import Excel — placeholder">
              <Upload className="h-4 w-4 mr-1" />Import Excel
            </Button>
            {canManageMatrix(role) && !readOnly && (
              <>
                <Button variant="outline" size="sm" onClick={handleRefresher} disabled={saving}>
                  <RefreshCw className="h-4 w-4 mr-1" />Process Refreshers
                </Button>
                <Button variant="outline" size="sm" onClick={handleAutoAssign} disabled={saving}>
                  Auto-Assign
                </Button>
                <Button size="sm" className="bg-blue-600" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" />Create Matrix
                </Button>
              </>
            )}
          </>
        }
      />

      <TmsFiltersBar filters={filters} onChange={setFilters} mode="matrix" />

      <div className="flex flex-wrap gap-2">
        {(['all', 'department', 'designation', 'sop'] as const).map((m) => (
          <Button key={m} variant={viewMode === m ? 'default' : 'outline'} size="sm"
            className={viewMode === m ? 'bg-blue-600' : ''} onClick={() => setViewMode(m)}>
            {m === 'all' ? 'All' : m === 'sop' ? 'SOP-wise' : `${m.charAt(0).toUpperCase()}${m.slice(1)}-wise`}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="definitions">Matrix Definitions ({definitions.length})</TabsTrigger>
          <TabsTrigger value="compliance">Employee Compliance ({compliance.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="definitions" className="mt-6">
          {loading ? <LoadingSpinner /> : grouped ? (
            <div className="space-y-4">
              {Object.entries(grouped).map(([key, items]) => (
                <Card key={key}>
                  <CardHeader className="py-3"><CardTitle className="text-base">{key} ({items.length})</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto p-0">{renderDefinitionTable(items)}</CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="overflow-x-auto p-0">{renderDefinitionTable(definitions)}</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          {loading ? <LoadingSpinner /> : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Employee Compliance Matrix</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportMatrixCsv(compliance)}>
                  <Download className="h-4 w-4 mr-1" />Export Compliance
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Designation</TableHead>
                      <TableHead>Required</TableHead><TableHead>Completed</TableHead><TableHead>Pending</TableHead>
                      <TableHead>Overdue</TableHead><TableHead>Compliance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compliance.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No compliance data</TableCell></TableRow>
                    ) : compliance.map((m) => (
                      <TableRow key={m.id}>
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
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Matrix Definition' : 'Create Matrix Definition'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem><FormLabel>Department *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="designation" render={({ field }) => (
                  <FormItem><FormLabel>Designation *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Role</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="training_topic" render={({ field }) => (
                  <FormItem><FormLabel>Training Topic *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="training_type" render={({ field }) => (
                  <FormItem><FormLabel>Training Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="training_frequency" render={({ field }) => (
                  <FormItem><FormLabel>Frequency *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{MATRIX_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="document_number" render={({ field }) => (
                  <FormItem><FormLabel>Document Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="document_title" render={({ field }) => (
                  <FormItem><FormLabel>Document Title</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="sop_number" render={({ field }) => (
                  <FormItem><FormLabel>SOP Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="sop_version" render={({ field }) => (
                  <FormItem><FormLabel>SOP Version</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="trainer_role" render={({ field }) => (
                  <FormItem><FormLabel>Trainer Role</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="training_duration" render={({ field }) => (
                  <FormItem><FormLabel>Duration</FormLabel><FormControl><Input {...field} placeholder="e.g. 2 hours" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="due_days_after_assignment" render={({ field }) => (
                  <FormItem><FormLabel>Due Days After Assignment</FormLabel>
                    <FormControl><Input type="number" min={1} {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{MATRIX_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="skill" render={({ field }) => (
                  <FormItem><FormLabel>Skill</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
              </div>
              <div className="flex flex-wrap gap-4">
                {(['training_required', 'initial_training_required', 'refresher_required', 'effectiveness_required'] as const).map((name) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="!mt-0 text-sm">{name.replace(/_/g, ' ')}</FormLabel>
                    </FormItem>
                  )} />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="bg-blue-600">{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Matrix Detail — {viewing?.matrix_code}</DialogTitle></DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['Department', viewing.department], ['Designation', viewing.designation], ['Role', viewing.role || '—'],
                ['Topic', viewing.training_topic], ['Type', viewing.training_type],
                ['Document', viewing.document_number || '—'], ['SOP', viewing.sop_number || '—'],
                ['Version', viewing.sop_version || '—'], ['Frequency', viewing.training_frequency],
                ['Duration', viewing.training_duration || '—'], ['Due Days', viewing.due_days_after_assignment],
                ['Trainer Role', viewing.trainer_role], ['Status', viewing.status],
                ['Initial Required', viewing.initial_training_required ? 'Yes' : 'No'],
                ['Refresher', viewing.refresher_required ? 'Yes' : 'No'],
                ['Effectiveness', viewing.effectiveness_required ? 'Yes' : 'No'],
                ['Created By', viewing.created_by_name], ['Updated', new Date(viewing.updated_at).toLocaleDateString()],
              ].map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
