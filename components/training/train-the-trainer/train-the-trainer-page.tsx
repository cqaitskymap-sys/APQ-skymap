'use client';

import { useCallback, useState } from 'react';
import { RefreshCw, Plus, Award, CheckCircle, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { useCompanyTraining } from '@/hooks/use-company-training';
import {
  submitTrainerAssessment, TRAINER_ASSESSMENT_CHECKLIST,
} from '@/lib/company-training-service';
import type { TrainerCertification } from '@/lib/company-training-types';

export function TrainTheTrainerPage() {
  const { data, loading, error, refresh, refreshing, actor, canCertifyTrainer } = useCompanyTraining();
  const [assessOpen, setAssessOpen] = useState(false);
  const [assessTrainer, setAssessTrainer] = useState({ id: '', name: '' });
  const [scores, setScores] = useState<Record<string, number>>({});

  const handleAssess = useCallback(async () => {
    if (!assessTrainer.name) return toast.error('Trainer name required');
    try {
      const result = await submitTrainerAssessment(actor, assessTrainer.id, assessTrainer.name, scores);
      toast.success(`Assessment ${result.result}: ${result.total_score}/${result.max_total}`);
      setAssessOpen(false);
      setScores({});
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assessment failed');
    }
  }, [actor, assessTrainer, scores, refresh]);

  const columns: ColumnDef<TrainerCertification>[] = [
    { key: 'cert', header: 'Cert #', render: (r) => r.certification_number },
    { key: 'trainer', header: 'Trainer', render: (r) => r.employee_name },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'desig', header: 'Designation', render: (r) => r.designation },
    {
      key: 'subjects', header: 'Subjects',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.subject_areas.map((s) => (
            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'score', header: 'Score',
      render: (r) => r.assessment_score != null
        ? <span className="font-medium">{r.assessment_score}%</span> : '—',
    },
    { key: 'certified', header: 'Certified', render: (r) => r.certification_date || '—' },
    { key: 'expiry', header: 'Expiry', render: (r) => r.expiry_date || '—' },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorCard message={error} onRetry={refresh} />;

  const trainers = data?.certifiedTrainers ?? [];

  return (
    <div>
      <TmsPageHeader
        title="Train the Trainer"
        description="Trainer certification, assessment checklist & list of certified trainers"
        trail={[{ label: 'Company Program', href: '/training/company-program' }, { label: 'Train the Trainer' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh()} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {canCertifyTrainer && (
              <Button size="sm" onClick={() => setAssessOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Assess Trainer
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard label="Certified Trainers" value={data?.totalCertifiedTrainers ?? 0} tone="green" />
        <KpiCard label="Expiring Soon" value={data?.trainerCertExpiring ?? 0} tone="amber" />
        <KpiCard label="Total Records" value={trainers.length} tone="blue" />
        <KpiCard label="Passing Score" value="80%" tone="blue" />
      </div>

      <Tabs defaultValue="registry">
        <TabsList>
          <TabsTrigger value="registry"><Award className="h-4 w-4 mr-1" /> Certified Trainer List</TabsTrigger>
          <TabsTrigger value="checklist"><ClipboardCheck className="h-4 w-4 mr-1" /> Assessment Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="registry" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">List of Certified Trainers</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveDataTable columns={columns} data={trainers} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trainer Assessment Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {TRAINER_ASSESSMENT_CHECKLIST.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <Badge variant="secondary">Weight: {item.weight}</Badge>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground mt-4">
                  Minimum passing score: 80%. Assessment covers subject knowledge, presentation skills,
                  GMP awareness, documentation, and practical demonstration capability.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={assessOpen} onOpenChange={setAssessOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trainer Assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Trainer Name</Label>
              <Input value={assessTrainer.name}
                onChange={(e) => setAssessTrainer({ ...assessTrainer, name: e.target.value })} />
            </div>
            {TRAINER_ASSESSMENT_CHECKLIST.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between mb-1">
                  <Label className="text-xs">{item.label}</Label>
                  <span className="text-xs text-muted-foreground">{scores[item.id] ?? 0}/{item.weight}</span>
                </div>
                <Slider
                  min={0} max={item.weight} step={1}
                  value={[scores[item.id] ?? 0]}
                  onValueChange={([v]) => setScores({ ...scores, [item.id]: v })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssessOpen(false)}>Cancel</Button>
            <Button onClick={handleAssess}>Submit Assessment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
