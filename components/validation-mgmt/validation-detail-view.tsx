'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Printer, Upload, Download, Link2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ValidationStatusBadge, PassFailBadge } from './validation-sub-nav';
import { ValidationPdfDocument } from './validation-pdf-document';
import { ValidationForm } from './validation-form';
import {
  getProtocol, saveProtocol, listExecutionSteps, addExecutionStep,
  getValidationAttachments, uploadValidationAttachment, getValidationApprovals,
  getAuditLogsForValidation, linkCapaFromValidation, submitValidationApproval,
  getProcessValidation, saveProcessValidation, getCleaningValidation, saveCleaningValidation,
  getCsvValidation, saveCsvValidation, updateValidation,
} from '@/lib/validation-mgmt-service';
import type {
  ValidationRecord, ValidationProtocol, ValidationExecutionStep,
  ValidationAttachment, ValidationApproval, ProcessValidationData,
  CleaningValidationData, CsvValidationData,
} from '@/lib/validation-mgmt-types';
import {
  canManageValidation, canApproveValidation, canExecuteValidation, isValidationReadOnly, PASS_FAIL,
} from '@/lib/validation-mgmt-types';
import {
  protocolSchema, executionStepSchema, approvalSchema,
  processValidationSchema, cleaningValidationSchema, csvValidationSchema,
  type ProtocolInput, type ExecutionStepInput, type ApprovalInput,
  type ProcessValidationInput, type CleaningValidationInput, type CsvValidationInput,
  type ValidationCreateInput,
} from '@/lib/validation-mgmt-schemas';
import { printPage } from '@/lib/export-utils';
import { useValidationActor } from '@/hooks/use-validation-mgmt';

const ATTACHMENT_CATEGORIES = [
  'Protocol', 'Execution Evidence', 'GMP Certificate', 'Calibration Certificate',
  'Test Report', 'Traceability Matrix', 'Part 11 Assessment', 'Regulatory Documents',
];

interface ValidationDetailViewProps {
  record: ValidationRecord;
  onRefresh: () => void;
  defaultTab?: string;
}

export function ValidationDetailView({ record, onRefresh, defaultTab = 'overview' }: ValidationDetailViewProps) {
  const actor = useValidationActor();
  const readOnly = isValidationReadOnly(actor.role);
  const canExecute = canExecuteValidation(actor.role, record.validation_type);
  const [protocol, setProtocol] = useState<ValidationProtocol | null>(null);
  const [steps, setSteps] = useState<ValidationExecutionStep[]>([]);
  const [attachments, setAttachments] = useState<ValidationAttachment[]>([]);
  const [approvals, setApprovals] = useState<ValidationApproval[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [processData, setProcessData] = useState<ProcessValidationData | null>(null);
  const [cleaningData, setCleaningData] = useState<CleaningValidationData | null>(null);
  const [csvData, setCsvData] = useState<CsvValidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [attachCategory, setAttachCategory] = useState(ATTACHMENT_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);

  const loadSub = async () => {
    setLoading(true);
    const [p, st, att, ap, logs, proc, clean, csv] = await Promise.all([
      getProtocol(record.id), listExecutionSteps(record.id), getValidationAttachments(record.id),
      getValidationApprovals(record.id), getAuditLogsForValidation(record.id),
      getProcessValidation(record.id), getCleaningValidation(record.id), getCsvValidation(record.id),
    ]);
    setProtocol(p); setSteps(st); setAttachments(att); setApprovals(ap);
    setAuditLogs(logs); setProcessData(proc); setCleaningData(clean); setCsvData(csv);
    setLoading(false);
  };

  useEffect(() => { void loadSub(); }, [record.id]);

  const protocolForm = useForm<ProtocolInput>({
    resolver: zodResolver(protocolSchema),
    defaultValues: { validation_id: record.id, objective: '', scope: '', responsibility: '', reference_documents: '', acceptance_criteria: '', pre_requisites: '', test_scripts: '', deviation_handling: '', version: record.protocol_version },
  });

  const stepForm = useForm<ExecutionStepInput>({
    resolver: zodResolver(executionStepSchema),
    defaultValues: { validation_id: record.id, test_step_no: steps.length + 1, test_description: '', expected_result: '', actual_result: '', pass_fail: 'N/A', execution_date: new Date().toISOString().split('T')[0], remarks: '' },
  });

  const approvalForm = useForm<ApprovalInput>({
    resolver: zodResolver(approvalSchema),
    defaultValues: { validation_id: record.id, approval_level: 'Final', decision: 'approved', comments: '' },
  });

  useEffect(() => {
    if (protocol) protocolForm.reset({ ...protocol, validation_id: record.id });
  }, [protocol]);

  useEffect(() => {
    stepForm.setValue('test_step_no', steps.length + 1);
  }, [steps.length]);

  const handleUpdate = async (data: ValidationCreateInput) => {
    try {
      await updateValidation(record.id, data, actor);
      toast.success('Validation updated');
      setEditing(false);
      onRefresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Update failed'); }
  };

  const handleProtocol = async (data: ProtocolInput) => {
    setSaving(true);
    try {
      const saved = await saveProtocol(data, actor);
      setProtocol(saved);
      toast.success('Protocol saved');
      onRefresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  };

  const handleStep = async (data: ExecutionStepInput) => {
    setSaving(true);
    try {
      await addExecutionStep(data, actor);
      toast.success('Execution step recorded');
      stepForm.reset({ validation_id: record.id, test_step_no: steps.length + 2, test_description: '', expected_result: '', actual_result: '', pass_fail: 'N/A', execution_date: new Date().toISOString().split('T')[0], remarks: '' });
      await loadSub();
      onRefresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  };

  const handleApproval = async (data: ApprovalInput) => {
    try {
      await submitValidationApproval(data, actor);
      toast.success(`Validation ${data.decision}`);
      await loadSub();
      onRefresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };

  const handleCapaLink = async () => {
    try {
      await linkCapaFromValidation(record.id, actor);
      toast.success('CAPA linked');
      onRefresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadValidationAttachment(record.id, file, attachCategory, actor);
      toast.success('Attachment uploaded');
      await loadSub();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Upload failed'); }
    e.target.value = '';
  };

  const info = [
    ['Validation Number', record.validation_number], ['Type', record.validation_type],
    ['Department', record.department], ['Product', record.product_name || '—'],
    ['Batch', record.batch_number || '—'], ['Equipment', record.equipment_name || '—'],
    ['System', record.system_name || '—'], ['Protocol', `${record.protocol_number} v${record.protocol_version}`],
    ['Start Date', record.validation_start_date], ['End Date', record.validation_end_date || '—'],
    ['Revalidation Due', record.revalidation_due_date || '—'],
    ['Prepared By', record.prepared_by_name], ['Reviewed By', record.reviewed_by_name || '—'],
    ['Approved By', record.approved_by_name || '—'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{record.validation_number}</p>
          <h1 className="text-2xl font-bold">{record.validation_title}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <ValidationStatusBadge status={record.validation_status} />
            {record.deviation_observed && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Deviation</span>}
            {record.linked_capa_number && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">CAPA: {record.linked_capa_number}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPrint(true)}><Printer className="h-4 w-4 mr-1" />Report</Button>
          {canManageValidation(actor.role) && !readOnly && (
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</Button>
          )}
        </div>
      </div>

      {editing && (
        <Card><CardHeader><CardTitle>Edit Validation</CardTitle></CardHeader>
          <CardContent><ValidationForm defaultValues={{
            ...record,
            change_control_number: record.change_control_number || '',
            change_control_id: record.change_control_id || undefined,
          }} lockType={record.validation_type} onSubmit={handleUpdate} onCancel={() => setEditing(false)} submitLabel="Update" /></CardContent>
        </Card>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {['overview', 'protocol', 'execution', 'results', 'deviation', 'attachments', 'history', 'trail'].map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs capitalize">{t === 'deviation' ? 'Deviation/CAPA' : t === 'history' ? 'Approval History' : t === 'trail' ? 'Audit Trail' : t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card><CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {info.map(([k, v]) => (
              <div key={k}><p className="text-xs text-muted-foreground">{k}</p><p className="text-sm font-medium">{v}</p></div>
            ))}
            {record.change_control_linked && record.change_control_number && (
              <div><p className="text-xs text-muted-foreground">Change Control</p>
                <Link href="/qms/change-control" className="text-sm text-blue-600">{record.change_control_number}</Link></div>
            )}
            {record.remarks && <div className="sm:col-span-2 lg:col-span-3"><p className="text-xs text-muted-foreground">Remarks</p><p className="text-sm">{record.remarks}</p></div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="protocol" className="mt-4">
          {canManageValidation(actor.role) && !readOnly ? (
            <Card><CardHeader><CardTitle>Validation Protocol</CardTitle></CardHeader>
              <CardContent>
                <Form {...protocolForm}><form onSubmit={protocolForm.handleSubmit(handleProtocol)} className="space-y-4">
                  {(['objective', 'scope', 'responsibility', 'reference_documents', 'acceptance_criteria', 'pre_requisites', 'test_scripts', 'deviation_handling'] as const).map((f) => (
                    <FormField key={f} control={protocolForm.control} name={f} render={({ field }) => (
                      <FormItem><FormLabel className="capitalize">{f.replace(/_/g, ' ')}</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                    )} />
                  ))}
                  <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Saving…' : 'Save Protocol'}</Button>
                </form></Form>
              </CardContent></Card>
          ) : protocol ? (
            <Card><CardContent className="p-6 space-y-4">
              {Object.entries(protocol).filter(([k]) => !['id', 'validation_id', 'created_at', 'updated_at'].includes(k)).map(([k, v]) => (
                v ? <div key={k}><p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</p><p className="text-sm whitespace-pre-wrap">{String(v)}</p></div> : null
              ))}
            </CardContent></Card>
          ) : <p className="text-muted-foreground text-sm">No protocol defined</p>}
        </TabsContent>

        <TabsContent value="execution" className="mt-4 space-y-4">
          {loading ? <LoadingSpinner /> : (
            <>
              <Card><CardContent className="p-0 overflow-x-auto">
                <Table><TableHeader><TableRow>
                  <TableHead>Step</TableHead><TableHead>Description</TableHead><TableHead>Expected</TableHead>
                  <TableHead>Actual</TableHead><TableHead>Result</TableHead><TableHead>Executed By</TableHead>
                </TableRow></TableHeader><TableBody>
                  {steps.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No execution steps</TableCell></TableRow>
                    : steps.map((s) => (
                      <TableRow key={s.id}><TableCell>{s.test_step_no}</TableCell><TableCell>{s.test_description}</TableCell>
                        <TableCell className="text-xs">{s.expected_result}</TableCell><TableCell className="text-xs">{s.actual_result}</TableCell>
                        <TableCell><PassFailBadge result={s.pass_fail} /></TableCell><TableCell className="text-xs">{s.executed_by_name}</TableCell></TableRow>
                    ))}
                </TableBody></Table>
              </CardContent></Card>
              {canExecute && !readOnly && (
                <Card><CardHeader><CardTitle>Add Test Step</CardTitle></CardHeader>
                  <CardContent>
                    <Form {...stepForm}><form onSubmit={stepForm.handleSubmit(handleStep)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={stepForm.control} name="test_step_no" render={({ field }) => (
                        <FormItem><FormLabel>Step No</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={stepForm.control} name="pass_fail" render={({ field }) => (
                        <FormItem><FormLabel>Pass/Fail</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{PASS_FAIL.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                          </Select></FormItem>
                      )} />
                      <FormField control={stepForm.control} name="test_description" render={({ field }) => (
                        <FormItem className="md:col-span-2"><FormLabel>Test Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={stepForm.control} name="expected_result" render={({ field }) => (
                        <FormItem><FormLabel>Expected Result</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={stepForm.control} name="actual_result" render={({ field }) => (
                        <FormItem><FormLabel>Actual Result</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                      )} />
                      <div className="md:col-span-2"><Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">Record Step</Button></div>
                    </form></Form>
                  </CardContent></Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          <TypeSpecificResults
            record={record} processData={processData} cleaningData={cleaningData} csvData={csvData}
            actor={actor} readOnly={readOnly} onSaved={loadSub}
          />
        </TabsContent>

        <TabsContent value="deviation" className="mt-4">
          <Card><CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Deviation Observed</p><p className="font-medium">{record.deviation_observed ? 'Yes' : 'No'}</p></div>
              <div><p className="text-xs text-muted-foreground">CAPA Required</p><p className="font-medium">{record.capa_required ? 'Yes' : 'No'}</p></div>
              {record.linked_deviation_number && (
                <div><p className="text-xs text-muted-foreground">Linked Deviation</p>
                  <Link href={`/qms/deviation/${record.linked_deviation_id}`} className="text-blue-600">{record.linked_deviation_number}</Link></div>
              )}
              {record.linked_capa_number && (
                <div><p className="text-xs text-muted-foreground">Linked CAPA</p>
                  <Link href={`/qms/capa/${record.linked_capa_id}`} className="text-blue-600">{record.linked_capa_number}</Link></div>
              )}
            </div>
            {record.capa_required && !record.linked_capa_id && canManageValidation(actor.role) && (
              <Button onClick={handleCapaLink} className="gap-2"><Link2 className="h-4 w-4" />Create CAPA Link</Button>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/qms/deviation"><Button variant="outline" size="sm">Deviations</Button></Link>
              <Link href="/qms/capa"><Button variant="outline" size="sm">CAPA</Button></Link>
              <Link href="/qms/change-control"><Button variant="outline" size="sm">Change Control</Button></Link>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="attachments" className="mt-4">
          <Card><CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Attachments</CardTitle>
            {!readOnly && (
              <div className="flex gap-2 items-center">
                <select className="text-sm border rounded px-2 py-1" value={attachCategory} onChange={(e) => setAttachCategory(e.target.value)}>
                  {ATTACHMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="cursor-pointer inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                  <Input type="file" className="hidden" onChange={handleUpload} />
                  <Upload className="h-4 w-4 mr-1" />Upload
                </label>
              </div>
            )}
          </CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Category</TableHead><TableHead>Date</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {attachments.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No attachments</TableCell></TableRow>
                  : attachments.map((a) => (
                    <TableRow key={a.id}><TableCell>{a.file_name}</TableCell><TableCell>{a.category}</TableCell>
                      <TableCell>{a.uploaded_at.split('T')[0]}</TableCell>
                      <TableCell><a href={a.download_url} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button></a></TableCell></TableRow>
                  ))}
              </TableBody></Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Level</TableHead><TableHead>Decision</TableHead><TableHead>Approver</TableHead><TableHead>Comments</TableHead></TableRow></TableHeader>
              <TableBody>
                {approvals.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No approvals yet</TableCell></TableRow>
                  : approvals.map((a) => (
                    <TableRow key={a.id}><TableCell>{a.approved_at.split('T')[0]}</TableCell><TableCell>{a.approval_level}</TableCell>
                      <TableCell>{a.decision}</TableCell><TableCell>{a.approver_name}</TableCell><TableCell>{a.comments}</TableCell></TableRow>
                  ))}
              </TableBody></Table>
            {canApproveValidation(actor.role) && !readOnly && (
              <div className="p-4 border-t">
                <Form {...approvalForm}><form onSubmit={approvalForm.handleSubmit(handleApproval)} className="flex flex-wrap gap-4 items-end">
                  <FormField control={approvalForm.control} name="approval_level" render={({ field }) => (
                    <FormItem><FormLabel>Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="Protocol">Protocol</SelectItem><SelectItem value="Review">Review</SelectItem><SelectItem value="Final">Final</SelectItem></SelectContent>
                      </Select></FormItem>
                  )} />
                  <FormField control={approvalForm.control} name="decision" render={({ field }) => (
                    <FormItem><FormLabel>Decision</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent>
                      </Select></FormItem>
                  )} />
                  <FormField control={approvalForm.control} name="comments" render={({ field }) => (
                    <FormItem className="flex-1 min-w-[200px]"><FormLabel>Comments</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <Button type="submit" className="bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4 mr-1" />Submit</Button>
                </form></Form>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="trail" className="mt-4">
          <Card><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>User</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {auditLogs.map((l) => (
                  <TableRow key={String(l.id)}><TableCell>{String(l.dateTime || '').split('T')[0]}</TableCell>
                    <TableCell>{String(l.action)}</TableCell><TableCell>{String(l.userName || '')}</TableCell>
                    <TableCell>{String(l.status || '')}</TableCell></TableRow>
                ))}
              </TableBody></Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {showPrint && (
        <div className="fixed inset-0 z-50 bg-background overflow-auto p-6">
          <div className="flex justify-end gap-2 mb-4 print:hidden">
            <Button onClick={printPage}>Print</Button>
            <Button variant="outline" onClick={() => setShowPrint(false)}>Close</Button>
          </div>
          <ValidationPdfDocument record={record} protocol={protocol} steps={steps} processData={processData} cleaningData={cleaningData} csvData={csvData} />
        </div>
      )}
    </div>
  );
}

function TypeSpecificResults({
  record, processData, cleaningData, csvData, actor, readOnly, onSaved,
}: {
  record: ValidationRecord;
  processData: ProcessValidationData | null;
  cleaningData: CleaningValidationData | null;
  csvData: CsvValidationData | null;
  actor: { id: string; name: string; role: string };
  readOnly: boolean;
  onSaved: () => void;
}) {
  if (record.validation_type === 'Process Validation') {
    return <ProcessForm record={record} data={processData} actor={actor} readOnly={readOnly} onSaved={onSaved} />;
  }
  if (record.validation_type === 'Cleaning Validation') {
    return <CleaningForm record={record} data={cleaningData} actor={actor} readOnly={readOnly} onSaved={onSaved} />;
  }
  if (record.validation_type === 'Computer System Validation') {
    return <CsvForm record={record} data={csvData} actor={actor} readOnly={readOnly} onSaved={onSaved} />;
  }
  return (
    <Card><CardContent className="p-6 text-sm text-muted-foreground">
      Execution summary: {record.validation_status}. View execution tab for test step results.
      {record.validation_status === 'Approved' && <p className="mt-2 text-green-700">Approved validation data is available for PQR Validation Review.</p>}
    </CardContent></Card>
  );
}

function ProcessForm({ record, data, actor, readOnly, onSaved }: { record: ValidationRecord; data: ProcessValidationData | null; actor: { id: string; name: string; role: string }; readOnly: boolean; onSaved: () => void }) {
  const form = useForm<ProcessValidationInput>({
    resolver: zodResolver(processValidationSchema),
    defaultValues: { validation_id: record.id, product: record.product_name, batch_no: record.batch_number, stage: '', cpp_parameter: '', cqa_parameter: '', acceptance_criteria: '', observed_result: '', conclusion: '', ...data },
  });
  const onSubmit = async (d: ProcessValidationInput) => {
    await saveProcessValidation(d, actor);
    toast.success('Process validation saved');
    onSaved();
  };
  if (readOnly && data) return <Card><CardContent className="p-6 grid grid-cols-2 gap-4">{Object.entries(data).filter(([k]) => !['id', 'validation_id', 'created_at'].includes(k)).map(([k, v]) => (
    <div key={k}><p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</p><p className="text-sm">{String(v)}</p></div>
  ))}</CardContent></Card>;
  return (
    <Card><CardContent className="p-6">
      <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['product', 'batch_no', 'stage', 'cpp_parameter', 'cqa_parameter', 'acceptance_criteria', 'observed_result', 'conclusion'] as const).map((f) => (
          <FormField key={f} control={form.control} name={f} render={({ field }) => (
            <FormItem className={f === 'conclusion' ? 'md:col-span-2' : ''}><FormLabel className="capitalize">{f.replace(/_/g, ' ')}</FormLabel>
              <FormControl>{f === 'conclusion' || f === 'acceptance_criteria' ? <Textarea rows={2} {...field} /> : <Input {...field} />}</FormControl></FormItem>
          )} />
        ))}
        <div className="md:col-span-2"><Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Results</Button></div>
      </form></Form>
    </CardContent></Card>
  );
}

function CleaningForm({ record, data, actor, readOnly, onSaved }: { record: ValidationRecord; data: CleaningValidationData | null; actor: { id: string; name: string; role: string }; readOnly: boolean; onSaved: () => void }) {
  const form = useForm<CleaningValidationInput>({
    resolver: zodResolver(cleaningValidationSchema),
    defaultValues: { validation_id: record.id, product_from: '', product_to: '', equipment: record.equipment_name, swab_location: '', maco_limit: '', observed_residue: '', result: '', cleaning_status: 'Pending', ...data },
  });
  const onSubmit = async (d: CleaningValidationInput) => {
    await saveCleaningValidation(d, actor);
    toast.success('Cleaning validation saved');
    onSaved();
  };
  if (readOnly && data) return <Card><CardContent className="p-6 grid grid-cols-2 gap-4">{Object.entries(data).filter(([k]) => !['id', 'validation_id', 'created_at'].includes(k)).map(([k, v]) => (
    <div key={k}><p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</p><p className="text-sm">{String(v)}</p></div>
  ))}</CardContent></Card>;
  return (
    <Card><CardContent className="p-6">
      <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['product_from', 'product_to', 'equipment', 'swab_location', 'maco_limit', 'observed_residue', 'result', 'cleaning_status'] as const).map((f) => (
          <FormField key={f} control={form.control} name={f} render={({ field }) => (
            <FormItem><FormLabel className="capitalize">{f.replace(/_/g, ' ')}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
          )} />
        ))}
        <div className="md:col-span-2"><Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save Results</Button></div>
      </form></Form>
    </CardContent></Card>
  );
}

function CsvForm({ record, data, actor, readOnly, onSaved }: { record: ValidationRecord; data: CsvValidationData | null; actor: { id: string; name: string; role: string }; readOnly: boolean; onSaved: () => void }) {
  const form = useForm<CsvValidationInput>({
    resolver: zodResolver(csvValidationSchema),
    defaultValues: { validation_id: record.id, system_name: record.system_name, gxp_impact: 'Direct GxP', risk_category: 'Medium', urs_number: '', frs_number: '', ds_number: '', iq_protocol: '', oq_protocol: '', pq_protocol: '', traceability_matrix: '', part11_assessment: '', validation_status: 'Draft', ...data },
  });
  const onSubmit = async (d: CsvValidationInput) => {
    await saveCsvValidation(d, actor);
    toast.success('CSV validation saved');
    onSaved();
  };
  if (readOnly && data) return <Card><CardContent className="p-6 grid grid-cols-2 gap-4">{Object.entries(data).filter(([k]) => !['id', 'validation_id', 'created_at'].includes(k)).map(([k, v]) => (
    <div key={k}><p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</p><p className="text-sm">{String(v)}</p></div>
  ))}</CardContent></Card>;
  return (
    <Card><CardContent className="p-6">
      <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['system_name', 'gxp_impact', 'risk_category', 'urs_number', 'frs_number', 'ds_number', 'iq_protocol', 'oq_protocol', 'pq_protocol', 'traceability_matrix', 'part11_assessment', 'validation_status'] as const).map((f) => (
          <FormField key={f} control={form.control} name={f} render={({ field }) => (
            <FormItem className={['traceability_matrix', 'part11_assessment'].includes(f) ? 'md:col-span-2' : ''}>
              <FormLabel className="capitalize">{f.replace(/_/g, ' ')}</FormLabel>
              <FormControl>{['traceability_matrix', 'part11_assessment'].includes(f) ? <Textarea rows={2} {...field} /> : <Input {...field} />}</FormControl>
            </FormItem>
          )} />
        ))}
        <div className="md:col-span-2"><Button type="submit" className="bg-blue-600 hover:bg-blue-700">Save CSV Data</Button></div>
      </form></Form>
    </CardContent></Card>
  );
}
