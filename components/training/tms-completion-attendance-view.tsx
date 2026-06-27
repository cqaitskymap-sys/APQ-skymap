'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Download, Upload, UserCheck, ClipboardCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TmsFiltersBar } from '@/components/training/tms-filters';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import {
  TmsStatusBadge, AttendanceBadge, CompletionBadge, ResultBadge,
} from '@/components/training/tms-sub-nav';
import { useTrainingCompletionAttendance } from '@/hooks/use-training';
import {
  recordAttendance, completeTraining, exportAttendanceCsv, exportTrainingRecordsCsv,
  uploadCompletionEvidence,
} from '@/lib/training-service';
import { attendanceSchema, completionSchema, type AttendanceInput, type CompletionInput } from '@/lib/training-schemas';
import {
  ATTENDANCE_STATUSES, TRAINING_MODES, type TmsFilters, type TrainingAssignment,
  canMarkAttendance, canCompleteTraining, canViewDepartmentTraining, isTmsReadOnly,
  isEmployeeTrainingView, calcTrainingResult,
} from '@/lib/training-types';
import type { TmsActor } from '@/lib/training-types';

type TabKey = 'attendance' | 'completion';

interface Props {
  defaultTab?: TabKey;
}

function filterByRole<T extends { employee_id: string; department: string }>(
  items: T[],
  role: string,
  userDepartment: string,
  userEmployeeId: string,
): T[] {
  if (canViewDepartmentTraining(role) || isTmsReadOnly(role)) {
    if (['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(role)
      && !['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'training_coordinator'].includes(role)) {
      return items.filter((i) => i.department === userDepartment);
    }
    return items;
  }
  if (isEmployeeTrainingView(role)) {
    return items.filter((i) => i.employee_id === userEmployeeId);
  }
  return items;
}

function openAssignments(assignments: TrainingAssignment[]) {
  return assignments.filter((a) => ['pending', 'in_progress', 'overdue', 'retraining'].includes(a.status));
}

export function TrainingCompletionAttendanceView({ defaultTab = 'completion' }: Props) {
  const [filters, setFilters] = useState<TmsFilters>({});
  const [tab, setTab] = useState<TabKey>(defaultTab);
  const [saving, setSaving] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const {
    assignments, attendance, records, masters, loading, error, refresh, role,
    userDepartment, userEmployeeId, actor,
  } = useTrainingCompletionAttendance(filters);

  const scopedAssignments = useMemo(
    () => filterByRole(assignments, role, userDepartment, userEmployeeId),
    [assignments, role, userDepartment, userEmployeeId],
  );
  const scopedAttendance = useMemo(
    () => filterByRole(attendance, role, userDepartment, userEmployeeId),
    [attendance, role, userDepartment, userEmployeeId],
  );
  const scopedRecords = useMemo(
    () => filterByRole(records, role, userDepartment, userEmployeeId),
    [records, role, userDepartment, userEmployeeId],
  );
  const actionable = openAssignments(scopedAssignments);

  const attendanceForm = useForm<AttendanceInput>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      assignment_id: '', employee_id: '', training_date: new Date().toISOString().split('T')[0],
      attendance_status: 'Present', trainer: '', start_time: '09:00', end_time: '17:00',
      trainer_verified: false,
    },
  });

  const completionForm = useForm<CompletionInput>({
    resolver: zodResolver(completionSchema),
    defaultValues: {
      assignment_id: '', employee_id: '', training_date: new Date().toISOString().split('T')[0],
      attendance_status: 'Present', trainer: '', training_mode: 'Classroom',
      start_time: '09:00', end_time: '17:00', assessment_score: null,
      trainer_comments: '', employee_comments: '', completion_evidence: '',
      trainer_verified: false,
    },
  });

  const selectedAssignmentId = completionForm.watch('assignment_id');
  const assessmentScore = completionForm.watch('assessment_score');
  const selectedMaster = useMemo(() => {
    const a = scopedAssignments.find((x) => x.id === selectedAssignmentId);
    return a ? masters.find((m) => m.id === a.training_master_id) : undefined;
  }, [selectedAssignmentId, scopedAssignments, masters]);

  const previewResult = useMemo(() => {
    const required = selectedMaster?.assessment_required ?? false;
    const passMarks = selectedMaster?.passing_percentage ?? 80;
    return calcTrainingResult(assessmentScore ?? null, passMarks, required);
  }, [assessmentScore, selectedMaster]);

  const onAssignmentSelect = (assignmentId: string, form: 'attendance' | 'completion') => {
    const a = scopedAssignments.find((x) => x.id === assignmentId);
    if (!a) return;
    if (form === 'attendance') {
      attendanceForm.setValue('employee_id', a.employee_id);
      attendanceForm.setValue('trainer', a.trainer_name);
    } else {
      completionForm.setValue('employee_id', a.employee_id);
      completionForm.setValue('trainer', a.trainer_name);
    }
  };

  const handleAttendance = async (data: AttendanceInput) => {
    setSaving(true);
    try {
      await recordAttendance(data, actor as TmsActor);
      toast.success('Attendance recorded');
      attendanceForm.reset({
        assignment_id: '', employee_id: '', training_date: new Date().toISOString().split('T')[0],
        attendance_status: 'Present', trainer: '', start_time: '09:00', end_time: '17:00',
        trainer_verified: false,
      });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleCompletion = async (data: CompletionInput) => {
    const required = selectedMaster?.assessment_required ?? false;
    if (required && (data.assessment_score == null || Number.isNaN(data.assessment_score))) {
      toast.error('Assessment score is required when assessment is required');
      return;
    }
    setSaving(true);
    try {
      const record = await completeTraining(data, actor as TmsActor, {
        assessmentRequired: required,
        passMarks: selectedMaster?.passing_percentage ?? 80,
      });
      if (evidenceFile) {
        await uploadCompletionEvidence(record.id, evidenceFile, actor as TmsActor);
      }
      toast.success(`Training completed — Result: ${record.training_result}`);
      completionForm.reset({
        assignment_id: '', employee_id: '', training_date: new Date().toISOString().split('T')[0],
        attendance_status: 'Present', trainer: '', training_mode: 'Classroom',
        start_time: '09:00', end_time: '17:00', assessment_score: null,
        trainer_comments: '', employee_comments: '', completion_evidence: '',
        trainer_verified: false,
      });
      setEvidenceFile(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Completion failed');
    } finally {
      setSaving(false);
    }
  };

  const readOnly = isTmsReadOnly(role);

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Completion & Attendance"
        description="Record attendance, completion evidence and training results"
        trail={[{ label: 'Completion & Attendance' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportAttendanceCsv(scopedAttendance)}>
              <Download className="h-4 w-4 mr-1" />Attendance CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportTrainingRecordsCsv(scopedRecords)}>
              <Download className="h-4 w-4 mr-1" />Records CSV
            </Button>
          </>
        }
      />

      <TmsFiltersBar filters={filters} onChange={setFilters} />
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="attendance" className="gap-2">
            <UserCheck className="h-4 w-4" />Mark Attendance
          </TabsTrigger>
          <TabsTrigger value="completion" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />Complete Training
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-6 mt-6">
          {canMarkAttendance(role) && !readOnly && (
            <Card className="border-blue-100 shadow-sm">
              <CardHeader><CardTitle className="text-base text-blue-900">Record Attendance</CardTitle></CardHeader>
              <CardContent>
                <Form {...attendanceForm}>
                  <form onSubmit={attendanceForm.handleSubmit(handleAttendance)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={attendanceForm.control} name="assignment_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Training Assignment *</FormLabel>
                          <Select onValueChange={(v) => { field.onChange(v); onAssignmentSelect(v, 'attendance'); }} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {actionable.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.training_number} — {a.employee_name} ({a.training_title})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={attendanceForm.control} name="training_date" render={({ field }) => (
                        <FormItem><FormLabel>Training Date *</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={attendanceForm.control} name="attendance_status" render={({ field }) => (
                        <FormItem><FormLabel>Attendance Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {ATTENDANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={attendanceForm.control} name="trainer" render={({ field }) => (
                        <FormItem><FormLabel>Trainer *</FormLabel>
                          <FormControl><Input {...field} /></FormControl><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={attendanceForm.control} name="start_time" render={({ field }) => (
                        <FormItem><FormLabel>Start Time</FormLabel>
                          <FormControl><Input type="time" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={attendanceForm.control} name="end_time" render={({ field }) => (
                        <FormItem><FormLabel>End Time</FormLabel>
                          <FormControl><Input type="time" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={attendanceForm.control} name="trainer_verified" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0">Trainer verification (sign-off)</FormLabel>
                      </FormItem>
                    )} />
                    <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                      {saving ? 'Saving…' : 'Mark Attendance'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {loading ? <LoadingSpinner /> : (
            <Card>
              <CardHeader><CardTitle>Attendance Records</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Training #</TableHead><TableHead>Employee</TableHead><TableHead>Department</TableHead>
                      <TableHead>Topic</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
                      <TableHead>Trainer</TableHead><TableHead>Verified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedAttendance.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No attendance records</TableCell></TableRow>
                    ) : scopedAttendance.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">{r.training_number}</TableCell>
                        <TableCell>{r.employee_name}</TableCell>
                        <TableCell>{r.department}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.training_topic}</TableCell>
                        <TableCell>{r.training_date}</TableCell>
                        <TableCell><AttendanceBadge status={r.attendance_status} /></TableCell>
                        <TableCell>{r.trainer}</TableCell>
                        <TableCell>{r.trainer_verified ? 'Yes' : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completion" className="space-y-6 mt-6">
          {canCompleteTraining(role) && !readOnly && (
            <Card className="border-blue-100 shadow-sm">
              <CardHeader><CardTitle className="text-base text-blue-900">Complete Training & Record Results</CardTitle></CardHeader>
              <CardContent>
                <Form {...completionForm}>
                  <form onSubmit={completionForm.handleSubmit(handleCompletion)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={completionForm.control} name="assignment_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Training Assignment *</FormLabel>
                          <Select onValueChange={(v) => { field.onChange(v); onAssignmentSelect(v, 'completion'); }} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {actionable.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.training_number} — {a.employee_name} ({a.training_title})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={completionForm.control} name="training_date" render={({ field }) => (
                        <FormItem><FormLabel>Training Date *</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={completionForm.control} name="attendance_status" render={({ field }) => (
                        <FormItem><FormLabel>Attendance Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {ATTENDANCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={completionForm.control} name="trainer" render={({ field }) => (
                        <FormItem><FormLabel>Trainer *</FormLabel>
                          <FormControl><Input {...field} /></FormControl><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={completionForm.control} name="training_mode" render={({ field }) => (
                        <FormItem><FormLabel>Training Mode</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {TRAINING_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                          </Select><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={completionForm.control} name="start_time" render={({ field }) => (
                        <FormItem><FormLabel>Start Time</FormLabel>
                          <FormControl><Input type="time" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={completionForm.control} name="end_time" render={({ field }) => (
                        <FormItem><FormLabel>End Time</FormLabel>
                          <FormControl><Input type="time" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      {selectedMaster?.assessment_required && (
                        <FormField control={completionForm.control} name="assessment_score" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assessment Score * (Pass: {selectedMaster.passing_percentage}%)</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} max={100}
                                value={field.value ?? ''}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                    </div>

                    {selectedMaster?.assessment_required && (
                      <div className="rounded-md bg-slate-50 dark:bg-slate-900/50 border px-4 py-3 text-sm">
                        Calculated result: <ResultBadge result={previewResult} />
                        {previewResult === 'Fail' && (
                          <span className="text-red-600 ml-2">— Retraining will be scheduled automatically</span>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={completionForm.control} name="trainer_comments" render={({ field }) => (
                        <FormItem><FormLabel>Trainer Comments</FormLabel>
                          <FormControl><Textarea rows={2} {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={completionForm.control} name="employee_comments" render={({ field }) => (
                        <FormItem><FormLabel>Employee Comments</FormLabel>
                          <FormControl><Textarea rows={2} {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>

                    <div className="space-y-2">
                      <FormLabel>Completion Evidence (placeholder upload)</FormLabel>
                      <div className="flex items-center gap-3">
                        <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                          className="max-w-sm"
                        />
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Signed attendance sheet, certificate, or assessment record</span>
                      </div>
                    </div>

                    <FormField control={completionForm.control} name="trainer_verified" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0">Trainer verification (sign-off)</FormLabel>
                      </FormItem>
                    )} />

                    <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                      {saving ? 'Saving…' : 'Complete Training'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {loading ? <LoadingSpinner /> : (
            <Card>
              <CardHeader><CardTitle>Training Completion Records</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record ID</TableHead><TableHead>Training #</TableHead><TableHead>Employee</TableHead>
                      <TableHead>Topic</TableHead><TableHead>Date</TableHead><TableHead>Attendance</TableHead>
                      <TableHead>Completion</TableHead><TableHead>Result</TableHead><TableHead>Score</TableHead>
                      <TableHead>Assignment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedRecords.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No completion records</TableCell></TableRow>
                    ) : scopedRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">{r.training_record_id}</TableCell>
                        <TableCell className="font-mono text-sm">{r.training_number}</TableCell>
                        <TableCell>{r.employee_name}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{r.training_topic}</TableCell>
                        <TableCell>{r.training_date}</TableCell>
                        <TableCell><AttendanceBadge status={r.attendance_status} /></TableCell>
                        <TableCell><CompletionBadge status={r.completion_status} /></TableCell>
                        <TableCell><ResultBadge result={r.training_result} /></TableCell>
                        <TableCell>{r.assessment_score ?? '—'}</TableCell>
                        <TableCell><TmsStatusBadge status={r.completion_status === 'Completed' ? 'completed' : r.completion_status === 'Failed' ? 'failed' : 'in_progress'} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
