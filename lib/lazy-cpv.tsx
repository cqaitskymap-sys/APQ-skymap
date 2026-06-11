'use client';

import dynamic from 'next/dynamic';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { KpiSkeleton } from '@/components/ui/table-skeleton';

const loading = () => <TableSkeleton rows={10} cols={6} />;
const dashboardLoading = () => <KpiSkeleton count={8} />;

export const LazyCppWorkspace = dynamic(
  () => import('@/components/cpv/cpp-workspace').then((m) => m.CppWorkspace),
  { loading, ssr: false },
);

export const LazyCqaWorkspace = dynamic(
  () => import('@/components/cpv/cqa-workspace').then((m) => m.CqaWorkspace),
  { loading, ssr: false },
);

export const LazyCpvDashboard = dynamic(
  () => import('@/components/cpv/dashboard-page').then((m) => m.CpvDashboardPage),
  { loading: dashboardLoading, ssr: false },
);

export const LazyCapabilityWorkspace = dynamic(
  () => import('@/components/cpv/capability-workspace').then((m) => m.CapabilityWorkspace),
  { loading, ssr: false },
);

export const LazyTrendWorkspace = dynamic(
  () => import('@/components/cpv/trend-workspace').then((m) => m.TrendWorkspace),
  { loading, ssr: false },
);

export const LazySpcWorkspace = dynamic(
  () => import('@/components/cpv/spc-workspace').then((m) => m.SpcWorkspace),
  { loading, ssr: false },
);

export const LazyAiAnalyticsWorkspace = dynamic(
  () => import('@/components/cpv/ai-analytics-workspace').then((m) => m.AiAnalyticsWorkspace),
  { loading: dashboardLoading, ssr: false },
);

export const LazyAnnualReviewPage = dynamic(
  () => import('@/components/cpv/annual-review-page').then((m) => m.AnnualReviewPage),
  { loading, ssr: false },
);
