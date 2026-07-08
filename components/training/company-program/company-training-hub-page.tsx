'use client';

import Link from 'next/link';
import {
  RefreshCw, GraduationCap, Users, ClipboardList, BookOpen,
  Wrench, FileCheck, ArrowRight, Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { TmsStatusBadge } from '@/components/training/tms-sub-nav';
import { useCompanyTraining } from '@/hooks/use-company-training';
import {
  INTERNAL_TRAINING_TYPES, EXTERNAL_TRAINING_TYPES,
  TRAINING_CLASSIFICATION, EVALUATION_METHODS,
} from '@/lib/company-training-types';

const MODULE_LINKS = [
  {
    title: 'Train the Trainer',
    description: 'Trainer certification, assessment checklist & certified trainer registry',
    href: '/training/train-the-trainer',
    icon: GraduationCap,
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50',
    countKey: 'totalCertifiedTrainers' as const,
    countLabel: 'Certified Trainers',
  },
  {
    title: 'Induction Workflow',
    description: 'HR induction → Department Head handover → TC → TNI → SOP assignment',
    href: '/training/induction',
    icon: Users,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50',
    countKey: 'activeInductions' as const,
    countLabel: 'Active Inductions',
  },
  {
    title: 'TNI (Training Needs Identification)',
    description: 'JD-based training needs identification → SOP mapping → training assignment',
    href: '/training/tni',
    icon: ClipboardList,
    color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/50',
    countKey: 'activeTniRecords' as const,
    countLabel: 'Active TNI Records',
  },
  {
    title: 'OJT Planner & Matrix',
    description: 'On-Job training planning, mentor assignment & competency matrix',
    href: '/training/ojt-planner',
    icon: Wrench,
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/50',
    countKey: 'activeOjtPlans' as const,
    countLabel: 'Active OJT Plans',
  },
  {
    title: 'Self Reading Declaration',
    description: 'SRD for Assistant Manager & above — document read & understood declaration',
    href: '/training/srd',
    icon: FileCheck,
    color: 'text-green-600 bg-green-50 dark:bg-green-950/50',
    countKey: 'pendingSrdDeclarations' as const,
    countLabel: 'Pending SRD',
  },
];

export function CompanyTrainingHubPage() {
  const { data, loading, refreshing, error, refresh, canView } = useCompanyTraining();

  const handleRefresh = async () => {
    try {
      await refresh();
      toast.success('Data refreshed');
    } catch {
      toast.error('Failed to refresh');
    }
  };

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view company training management.</AlertDescription>
      </Alert>
    );
  }

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <ErrorCard message={error} onRetry={refresh} />;

  return (
    <div>
      <TmsPageHeader
        title="Company Training Program"
        description="Internal & External training management per company SOP — Induction, TNI, OJT, SRD & Train the Trainer"
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Training Classification */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              Internal Training
            </CardTitle>
            <CardDescription>Company-conducted training programs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {INTERNAL_TRAINING_TYPES.map((type) => {
                const count = data?.internalTrainingBreakdown.find((b) => b.type === type)?.count ?? 0;
                return (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {type} {count > 0 && <span className="ml-1 font-bold">({count})</span>}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-600" />
              External Training
            </CardTitle>
            <CardDescription>Seminars, workshops, vendor & regulatory training</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {EXTERNAL_TRAINING_TYPES.map((type) => (
                <Badge key={type} variant="outline" className="text-xs">{type}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evaluation Methods */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evaluation Methods</CardTitle>
          <CardDescription>How training effectiveness is evaluated per company process</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {EVALUATION_METHODS.map((method) => {
              const usage = data?.evaluationMethodUsage.find((e) => e.method === method)?.count ?? 0;
              return (
                <div key={method} className="rounded-lg border p-3 text-center">
                  <p className="text-sm font-medium">{method}</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{usage}</p>
                  <p className="text-xs text-muted-foreground">records using this method</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Process Flow */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Induction Process Flow</CardTitle>
          <CardDescription>HR → Department Head → Training Coordinator → TNI → SOP Training</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {['HR Induction', 'Dept Head Handover', 'JD Preparation', 'TNI from JD', 'SOP Training', 'Evaluation'].map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                <Badge variant="outline">{step}</Badge>
                {i < 5 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Module Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {MODULE_LINKS.map((mod) => {
          const Icon = mod.icon;
          const count = data ? data[mod.countKey] : 0;
          return (
            <Link key={mod.href} href={mod.href}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className={`rounded-lg p-2 ${mod.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">{count}</span>
                  </div>
                  <CardTitle className="text-base mt-2">{mod.title}</CardTitle>
                  <CardDescription className="text-xs">{mod.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{mod.countLabel}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent Activity */}
      {data && data.inductionRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Induction Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.inductionRecords.slice(0, 5).map((ind) => (
                <div key={ind.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-sm">{ind.employee_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ind.induction_number} · {ind.department} · {ind.current_stage}
                    </p>
                  </div>
                  <TmsStatusBadge status={ind.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
