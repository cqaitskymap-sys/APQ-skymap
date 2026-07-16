'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus, BookOpen, HelpCircle, Users, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { WorkflowDiagram } from '@/components/training/workflow/workflow-diagram';
import { TRAINING_CONTENT_WORKFLOW } from '@/lib/enterprise-tms/workflows';
import { TrainingMasterForm } from '@/components/training/tms-master-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEnterpriseTms } from '@/hooks/use-enterprise-tms';
import { listTrainingMaster, createMaster } from '@/lib/training-assignment-service';
import type { TrainingMaster } from '@/lib/training-types';
import type { QuestionBankItem } from '@/lib/enterprise-tms';
import type { TrainingMasterInput } from '@/lib/training-schemas';

export function TrainingContentPage() {
  const { actor, listQuestionBank } = useEnterpriseTms();
  const [masters, setMasters] = useState<TrainingMaster[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [m, q] = await Promise.all([listTrainingMaster(), listQuestionBank()]);
    setMasters(m);
    setQuestions(q);
    setLoading(false);
  }, [listQuestionBank]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: TrainingMasterInput) => {
    setSaving(true);
    try {
      await createMaster(data, actor);
      toast.success('Content created — submit for approval');
      setCreateOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const masterColumns: ColumnDef<TrainingMaster>[] = [
    { key: 'title', header: 'Title', render: (r) => r.training_title },
    { key: 'type', header: 'Content Type', render: (r) => <Badge variant="outline">{r.training_type}</Badge> },
    { key: 'trainer', header: 'Trainer', render: (r) => r.trainer_name },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  const questionColumns: ColumnDef<QuestionBankItem>[] = [
    { key: 'code', header: 'Code', render: (r) => r.question_code },
    { key: 'text', header: 'Question', render: (r) => <span className="text-xs line-clamp-2">{r.question_text}</span> },
    { key: 'type', header: 'Type', render: (r) => r.question_type },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Content"
        description="Create content types, documents, questionnaires, assign trainers, submit for approval"
        trail={[{ label: 'Setup' }, { label: 'Training Content' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => load()}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Content</Button>
            <Button size="sm" variant="secondary" onClick={() => toast.success('Sent for approval')}>
              <Send className="h-4 w-4 mr-2" /> Submit for Approval
            </Button>
          </div>
        }
      />

      <WorkflowDiagram workflow={TRAINING_CONTENT_WORKFLOW} activeStepId="3" />

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content"><BookOpen className="h-4 w-4 mr-1" /> Content</TabsTrigger>
          <TabsTrigger value="questionnaire"><HelpCircle className="h-4 w-4 mr-1" /> Questionnaire</TabsTrigger>
          <TabsTrigger value="trainers"><Users className="h-4 w-4 mr-1" /> Trainer Setup</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="mt-4">
          <Card><CardContent className="pt-6"><ResponsiveDataTable columns={masterColumns} data={masters} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="questionnaire" className="mt-4">
          <Card><CardContent className="pt-6"><ResponsiveDataTable columns={questionColumns} data={questions} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="trainers" className="mt-4">
          <Card><CardContent className="pt-6"><ResponsiveDataTable columns={masterColumns} data={masters.filter((m, i, a) => a.findIndex((x) => x.trainer_name === m.trainer_name) === i)} /></CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Training Content</DialogTitle></DialogHeader>
          <TrainingMasterForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} saving={saving} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
