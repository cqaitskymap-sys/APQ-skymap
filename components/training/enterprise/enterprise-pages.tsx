'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { useEnterpriseTms } from '@/hooks/use-enterprise-tms';
import {
  createTrainingRequest, createNeedBasedTraining, updateTrainingSettings,
  runTrainingAutomation, listAutomationLog,
  type TrainingRequest, type NeedBasedTrainingRecord, type QuestionBankItem,
  type ExternalTrainingRecord, type TrainerQualification, type TrainerRenewal,
  type PracticalAssessment, type TrainingAutomationLog, type TrainingSettings,
} from '@/lib/enterprise-tms';
import { AUTOMATION_RULES, QMS_INTEGRATIONS } from '@/lib/enterprise-tms/modules';
import { NEED_BASED_TRIGGERS } from '@/lib/enterprise-tms/types';
import { EnterpriseListPage } from './enterprise-module-pages';

function useListData<T>(loader: () => Promise<T[]>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load training records');
    } finally {
      setLoading(false);
    }
  }, [loader]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

export function TrainingRequestPage() {
  const { actor, listTrainingRequests, refreshing, refresh } = useEnterpriseTms();
  const { data, loading, error, reload } = useListData(listTrainingRequests);

  const handleCreate = async () => {
    await createTrainingRequest(actor, {
      department: actor.department ?? 'Production',
      training_type: 'GMP Training',
      training_topic: 'New Training Request',
      justification: 'Business need identified',
    });
    toast.success('Training request submitted');
    await reload();
  };

  const columns: ColumnDef<TrainingRequest>[] = [
    { key: 'num', header: 'Request #', render: (r) => r.request_number },
    { key: 'by', header: 'Requested By', render: (r) => r.requested_by_name },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'type', header: 'Type', render: (r) => r.training_type },
    { key: 'topic', header: 'Topic', render: (r) => r.training_topic },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  return (
    <EnterpriseListPage
      title="Training Request" description="Submit and track training requests — HOD & QA approval workflow"
      trail={[{ label: 'Planning' }, { label: 'Training Request' }]}
      kpis={[
        { label: 'Total', value: data.length, tone: 'blue' },
        { label: 'Pending', value: data.filter((r) => r.status.startsWith('Pending')).length, tone: 'amber' },
        { label: 'Approved', value: data.filter((r) => r.status === 'Approved').length, tone: 'green' },
      ]}
      columns={columns} data={data} loading={loading} error={error} onRefresh={reload}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refresh(); reload(); }}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
          <Button size="sm" onClick={handleCreate}><Plus className="h-4 w-4 mr-2" /> New Request</Button>
        </div>
      }
    />
  );
}

export function NeedBasedTrainingPage() {
  const { actor, listNeedBasedTraining, refreshing, refresh } = useEnterpriseTms();
  const { data, loading, error, reload } = useListData(listNeedBasedTraining);

  const handleTrigger = async (trigger: string) => {
    await createNeedBasedTraining(actor, trigger, `${trigger}-${Date.now()}`, `Auto ${trigger}`, actor.department ?? 'QA', `${trigger} Training`, `${trigger} triggered training`);
    toast.success(`${trigger} training auto-generated`);
    await reload();
  };

  const columns: ColumnDef<NeedBasedTrainingRecord>[] = [
    { key: 'num', header: 'Record #', render: (r) => r.record_number },
    { key: 'trigger', header: 'Trigger', render: (r) => <Badge variant="outline">{r.trigger_source}</Badge> },
    { key: 'ref', header: 'Source Ref', render: (r) => r.source_ref },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'topic', header: 'Topic', render: (r) => r.training_topic },
    { key: 'due', header: 'Due', render: (r) => r.due_date },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <EnterpriseListPage
        title="Need Based Training" description="Auto-generated from CAPA, Deviation, OOS, CC, Audit & more"
        trail={[{ label: 'Programs' }, { label: 'Need Based' }]}
        kpis={[
          { label: 'Active', value: data.filter((n) => n.status !== 'Completed').length, tone: 'amber' },
          { label: 'Auto-Generated', value: data.filter((n) => n.auto_generated).length, tone: 'blue' },
          { label: 'Total', value: data.length, tone: 'green' },
        ]}
        columns={columns} data={data} loading={loading} error={error} onRefresh={reload}
        actions={<Button variant="outline" size="sm" onClick={() => { refresh(); reload(); }}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>}
      />
      <Card>
        <CardHeader><CardTitle className="text-sm">Trigger Sources</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {NEED_BASED_TRIGGERS.map((t) => (
            <Button key={t} variant="outline" size="sm" onClick={() => handleTrigger(t)}>{t}</Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function QuestionnairePage() {
  const { listQuestionBank } = useEnterpriseTms();
  const { data, loading, error, reload } = useListData(listQuestionBank);

  const columns: ColumnDef<QuestionBankItem>[] = [
    { key: 'code', header: 'Code', render: (r) => r.question_code },
    { key: 'text', header: 'Question', render: (r) => <span className="text-xs">{r.question_text}</span> },
    { key: 'type', header: 'Type', render: (r) => r.question_type },
    { key: 'sop', header: 'SOP', render: (r) => r.sop_number },
    { key: 'weight', header: 'Weight', render: (r) => r.passing_weight },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  return (
    <EnterpriseListPage
      title="Questionnaire" description="Question bank — MCQ, descriptive, practical with auto-evaluation"
      trail={[{ label: 'Evaluation' }, { label: 'Questionnaire' }]}
      kpis={[
        { label: 'Questions', value: data.length, tone: 'blue' },
        { label: 'MCQ', value: data.filter((q) => q.question_type === 'MCQ').length, tone: 'green' },
        { label: 'Active', value: data.filter((q) => q.status === 'Active').length, tone: 'amber' },
      ]}
      columns={columns} data={data} loading={loading} error={error} onRefresh={reload}
    />
  );
}

export function ExternalTrainingPage() {
  const { listExternalTraining } = useEnterpriseTms();
  const { data, loading, error, reload } = useListData(listExternalTraining);

  const columns: ColumnDef<ExternalTrainingRecord>[] = [
    { key: 'num', header: 'Record #', render: (r) => r.record_number },
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'title', header: 'Training', render: (r) => r.training_title },
    { key: 'provider', header: 'Provider', render: (r) => r.provider },
    { key: 'type', header: 'Type', render: (r) => r.training_type },
    { key: 'cert', header: 'Certificate', render: (r) => r.certificate_received ? 'Yes' : 'No' },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  return (
    <EnterpriseListPage
      title="External Training" description="Seminars, workshops, vendor & regulatory external training"
      trail={[{ label: 'Programs' }, { label: 'External' }]}
      kpis={[{ label: 'Records', value: data.length, tone: 'blue' }, { label: 'Completed', value: data.filter((e) => e.status === 'Completed').length, tone: 'green' }]}
      columns={columns} data={data} loading={loading} error={error} onRefresh={reload}
    />
  );
}

export function TrainerQualificationPage() {
  const { listTrainerQualifications } = useEnterpriseTms();
  const { data, loading, error, reload } = useListData(listTrainerQualifications);

  const columns: ColumnDef<TrainerQualification>[] = [
    { key: 'name', header: 'Trainer', render: (r) => r.trainer_name },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'type', header: 'Qualification', render: (r) => r.qualification_type },
    { key: 'exp', header: 'Experience', render: (r) => `${r.experience_years} yrs` },
    { key: 'expiry', header: 'Expiry', render: (r) => r.expiry_date },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  return (
    <EnterpriseListPage title="Trainer Qualification" description="Trainer experience, subject areas & qualification records"
      trail={[{ label: 'Trainer Management' }, { label: 'Qualification' }]}
      columns={columns} data={data} loading={loading} error={error} onRefresh={reload}
    />
  );
}

export function TrainerRenewalPage() {
  const { listTrainerRenewals } = useEnterpriseTms();
  const { data, loading, error, reload } = useListData(listTrainerRenewals);

  const columns: ColumnDef<TrainerRenewal>[] = [
    { key: 'num', header: 'Renewal #', render: (r) => r.renewal_number },
    { key: 'name', header: 'Trainer', render: (r) => r.trainer_name },
    { key: 'prev', header: 'Previous Cert', render: (r) => r.previous_cert_number },
    { key: 'score', header: 'Score', render: (r) => r.assessment_score },
    { key: 'expiry', header: 'New Expiry', render: (r) => r.new_expiry_date },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  return (
    <EnterpriseListPage title="Trainer Renewal" description="Trainer certificate renewal workflow"
      trail={[{ label: 'Trainer Management' }, { label: 'Renewal' }]}
      columns={columns} data={data} loading={loading} error={error} onRefresh={reload}
    />
  );
}

export function PracticalAssessmentPage() {
  const { listPracticalAssessments } = useEnterpriseTms();
  const { data, loading, error, reload } = useListData(listPracticalAssessments);

  const columns: ColumnDef<PracticalAssessment>[] = [
    { key: 'num', header: 'Assessment #', render: (r) => r.assessment_number },
    { key: 'emp', header: 'Employee', render: (r) => r.employee_name },
    { key: 'sop', header: 'SOP', render: (r) => r.sop_number },
    { key: 'score', header: 'Score', render: (r) => r.total_score },
    { key: 'result', header: 'Result', render: (r) => <TmsStatusBadge status={r.result} /> },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  return (
    <EnterpriseListPage title="Practical Assessment" description="Hands-on practical evaluation with checklist scoring"
      trail={[{ label: 'Evaluation' }, { label: 'Practical Assessment' }]}
      columns={columns} data={data} loading={loading} error={error} onRefresh={reload}
    />
  );
}

export function TrainingPlannerPage() {
  const { listAnnualPlans } = useEnterpriseTms();
  const { data: plans, loading, error, reload } = useListData(listAnnualPlans);
  const stages = ['Planned', 'Scheduled', 'In Progress', 'Evaluation', 'Completed'];
  const items = plans.flatMap((plan) => plan.training_items.map((item, index) => ({
    id: `${plan.id}-${index}`,
    title: item.topic,
    dept: plan.department,
    stage: stages.includes(item.status) ? item.status : 'Planned',
    due: item.planned_month,
  })));

  return (
    <div className="space-y-6">
      <TmsPageHeader title="Training Planner" description="Kanban-style organizational training planning"
        trail={[{ label: 'Planning' }, { label: 'Planner' }]} />
      {loading && <LoadingSkeleton rows={5} />}
      {error && <ErrorCard message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Add training items to an annual plan to populate the planner.
          </CardContent>
        </Card>
      )}
      {!loading && !error && items.length > 0 && (
      <div className="grid gap-4 md:grid-cols-5 overflow-x-auto">
        {stages.map((stage) => (
          <Card key={stage} className="shadow-sm min-w-[200px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                {stage}
                <Badge variant="secondary">{items.filter((i) => i.stage === stage).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.filter((i) => i.stage === stage).map((item) => (
                <div key={item.id} className="rounded-lg border p-3 bg-card hover:shadow-md transition-shadow cursor-pointer">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.dept} · Planned {item.due}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      )}
    </div>
  );
}

const AUTOMATION_SETTING_KEYS: Partial<Record<(typeof AUTOMATION_RULES)[number]['id'], keyof TrainingSettings>> = {
  'auto-sop': 'auto_assign_sop_training',
  'auto-revised-sop': 'auto_assign_revised_sop',
  'auto-refresher': 'auto_generate_refresher',
  'auto-induction': 'auto_induction_new_employee',
  'auto-notify-emp': 'auto_notify_employee',
  'auto-notify-hod': 'auto_notify_hod',
  'auto-notify-qa': 'auto_notify_qa',
  'auto-certificate': 'auto_generate_certificate',
  'auto-renewal': 'auto_schedule_renewal',
};

export function TrainingSettingsPage() {
  const { settings, refresh, actor } = useEnterpriseTms();
  const [local, setLocal] = useState(settings);
  const [logs, setLogs] = useState<TrainingAutomationLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState<string | null>(null);

  useEffect(() => { setLocal(settings); }, [settings]);
  useEffect(() => {
    listAutomationLog()
      .then(setLogs)
      .catch((cause) => toast.error(cause instanceof Error ? cause.message : 'Failed to load automation log'));
  }, []);

  const handleSave = async () => {
    if (!local) return;
    if (local.passing_percentage_default < 1 || local.passing_percentage_default > 100) {
      toast.error('Default passing percentage must be between 1 and 100');
      return;
    }
    if (local.certificate_validity_months < 1 || local.trainer_cert_validity_months < 1) {
      toast.error('Certificate validity must be at least one month');
      return;
    }
    setSaving(true);
    try {
      await updateTrainingSettings(actor, local);
      toast.success('Settings saved');
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save training settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRunAutomation = async (trigger: string) => {
    setRunningAutomation(trigger);
    try {
      const log = await runTrainingAutomation(actor, trigger, `${trigger}-MANUAL-${Date.now()}`);
      toast.success(`Automation: ${log.status} — ${log.records_affected} records`);
      setLogs(await listAutomationLog());
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Automation failed');
    } finally {
      setRunningAutomation(null);
    }
  };

  if (!local) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <TmsPageHeader title="Training Settings" description="Automation rules, thresholds & 21 CFR Part 11 compliance"
        trail={[{ label: 'Administration' }, { label: 'Settings' }]}
        actions={<Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>}
      />
      <Tabs defaultValue="automation">
        <TabsList>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="log">Automation Log</TabsTrigger>
        </TabsList>
        <TabsContent value="automation" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Automation Rules</CardTitle>
              <CardDescription>Configure automatic training workflows per GMP requirements</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {AUTOMATION_RULES.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor={rule.id}>{rule.label}</Label>
                    {!AUTOMATION_SETTING_KEYS[rule.id] && (
                      <p className="text-xs text-muted-foreground">Requires a configured backend workflow</p>
                    )}
                  </div>
                  <Switch
                    id={rule.id}
                    disabled={!AUTOMATION_SETTING_KEYS[rule.id]}
                    checked={Boolean(AUTOMATION_SETTING_KEYS[rule.id] && local[AUTOMATION_SETTING_KEYS[rule.id]!] )}
                    onCheckedChange={(checked) => {
                      const key = AUTOMATION_SETTING_KEYS[rule.id];
                      if (key) setLocal({ ...local, [key]: checked });
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Test Automation</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {['CAPA', 'Deviation', 'Change Control', 'New Employee'].map((t) => (
                <Button key={t} variant="outline" size="sm" disabled={runningAutomation !== null} onClick={() => handleRunAutomation(t)}>
                  <Play className="h-3 w-3 mr-1" /> {runningAutomation === t ? 'Running…' : `Run ${t}`}
                </Button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="thresholds" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div><Label>Default Passing %</Label><Input type="number" min={1} max={100} value={local.passing_percentage_default} onChange={(e) => setLocal({ ...local, passing_percentage_default: Number(e.target.value) })} /></div>
              <div><Label>Certificate Validity (months)</Label><Input type="number" min={1} max={120} value={local.certificate_validity_months} onChange={(e) => setLocal({ ...local, certificate_validity_months: Number(e.target.value) })} /></div>
              <div><Label>Trainer Cert Validity (months)</Label><Input type="number" min={1} max={120} value={local.trainer_cert_validity_months} onChange={(e) => setLocal({ ...local, trainer_cert_validity_months: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2"><Switch checked={local.e_signature_required} onCheckedChange={(c) => setLocal({ ...local, e_signature_required: c })} /><Label>E-Signature Required (21 CFR Part 11)</Label></div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {QMS_INTEGRATIONS.map((i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border p-3">
                    <Badge variant="outline">Integration point</Badge>
                    <span className="text-sm">{i}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="log" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-2">
              {logs.length === 0 ? <p className="text-sm text-muted-foreground">No automation logs yet</p> : logs.map((l) => (
                <div key={l.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex justify-between"><span className="font-medium">{l.action}</span><TmsStatusBadge status={l.status} /></div>
                  <p className="text-xs text-muted-foreground mt-1">{l.executed_at} · {l.details}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Re-export from module pages
export { AnnualTrainingPlanPage } from './enterprise-module-pages';
