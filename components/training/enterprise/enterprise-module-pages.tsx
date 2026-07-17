'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { useEnterpriseTms } from '@/hooks/use-enterprise-tms';
import { createAnnualPlan, type AnnualTrainingPlan } from '@/lib/enterprise-tms';
import { INDUCTION_WORKFLOW_STEPS } from '@/lib/enterprise-tms/modules';

type EnterpriseListPageProps<T extends { id: string }> = {
  title: string;
  description: string;
  trail?: { label: string; href?: string }[];
  kpis?: { label: string; value: string | number; tone?: 'blue' | 'green' | 'amber' | 'red' }[];
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  actions?: React.ReactNode;
  showWorkflow?: boolean;
};

export function EnterpriseListPage<T extends { id: string }>({
  title, description, trail, kpis, columns, data, loading, error, onRefresh, refreshing, actions, showWorkflow,
}: EnterpriseListPageProps<T>) {
  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) {
    return (
      <div className="space-y-6">
        <TmsPageHeader title={title} description={description} trail={trail} actions={actions} />
        <ErrorCard message={error} onRetry={onRefresh} />
      </div>
    );
  }
  return (
    <div className="space-y-6 animate-in fade-in">
      <TmsPageHeader title={title} description={description} trail={trail} actions={actions} />
      {kpis && kpis.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => <KpiCard key={k.label} label={k.label} value={k.value} tone={k.tone ?? 'blue'} />)}
        </div>
      )}
      {showWorkflow && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Induction Workflow</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {INDUCTION_WORKFLOW_STEPS.map((step, i) => (
                <Badge key={step} variant={i < 5 ? 'default' : 'outline'} className="text-[10px]">{step}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <ResponsiveDataTable columns={columns} data={data} />
        </CardContent>
      </Card>
    </div>
  );
}

export function AnnualTrainingPlanPage() {
  const { actor, listAnnualPlans, refreshing, refresh } = useEnterpriseTms();
  const [plans, setPlans] = useState<AnnualTrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await listAnnualPlans());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load annual training plans');
    } finally {
      setLoading(false);
    }
  }, [listAnnualPlans]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    await createAnnualPlan(actor, {
      department: actor.department ?? 'QA',
      title: `${new Date().getFullYear()} Annual Training Plan`,
      plan_year: new Date().getFullYear(),
      training_items: [],
    });
    toast.success('Annual plan created');
    await load();
  };

  const columns: ColumnDef<AnnualTrainingPlan>[] = [
    { key: 'num', header: 'Plan #', render: (r) => r.plan_number },
    { key: 'year', header: 'Year', render: (r) => r.plan_year },
    { key: 'dept', header: 'Department', render: (r) => r.department },
    { key: 'title', header: 'Title', render: (r) => r.title },
    { key: 'items', header: 'Items', render: (r) => r.training_items.length },
    { key: 'status', header: 'Status', render: (r) => <TmsStatusBadge status={r.status} /> },
  ];

  return (
    <EnterpriseListPage
      title="Annual Training Plan"
      description="Department-wise yearly training planning — GMP compliant"
      trail={[{ label: 'Planning' }, { label: 'Annual Plan' }]}
      kpis={[
        { label: 'Total Plans', value: plans.length, tone: 'blue' },
        { label: 'Approved', value: plans.filter((p) => p.status === 'Approved').length, tone: 'green' },
        { label: 'Draft', value: plans.filter((p) => p.status === 'Draft').length, tone: 'amber' },
      ]}
      columns={columns} data={plans} loading={loading} error={error} refreshing={refreshing}
      onRefresh={() => { refresh(); void load(); }}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refresh(); load(); }} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={handleCreate}><Plus className="h-4 w-4 mr-2" /> New Plan</Button>
        </div>
      }
    />
  );
}
