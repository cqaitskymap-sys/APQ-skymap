'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, BarChart3, ChevronRight, FileDown, FileText, RefreshCw, Search,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { fetchDashboardReportsData } from '@/lib/dashboard-reports-service';
import {
  REGULATORY_REPORT_TYPES,
  REPORT_MODULE_CATALOG,
  type DashboardReportsData,
} from '@/lib/dashboard-reports-records';
import { cn } from '@/lib/utils';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('export') || s.includes('generat') || s.includes('complete')) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
  if (s.includes('draft') || s.includes('pending')) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  }
  if (s.includes('fail') || s.includes('error')) {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

export function DashboardReportsPage() {
  const [data, setData] = useState<DashboardReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchDashboardReportsData();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return REPORT_MODULE_CATALOG;
    return REPORT_MODULE_CATALOG
      .map((category) => ({
        ...category,
        modules: category.modules.filter(
          (mod) =>
            mod.label.toLowerCase().includes(q)
            || mod.description.toLowerCase().includes(q)
            || mod.reportTypes.some((t) => t.toLowerCase().includes(q)),
        ),
      }))
      .filter((category) => category.modules.length > 0);
  }, [search]);

  if (loading) {
    return (
      <div className="space-y-6">
        <CpvPageHeader
          title="Reports"
          description="Loading QMS analytics and regulatory reports..."
          trail={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports' }]}
        />
        <LoadingSkeleton rows={3} />
      </div>
    );
  }

  if (!data) return null;

  const { kpis, recentActivity, byModule } = data;

  return (
    <div className="space-y-6">
      <CpvPageHeader
        title="Reports"
        description="QMS analytics and regulatory reports — access module reports, track generation activity, and export GMP-compliant registers."
        trail={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports' }]}
        actions={(
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        )}
      />

      {data.error && <ErrorCard message={data.error} onRetry={load} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Reports Generated" value={kpis.totalReports} tone="blue" />
        <KpiCard label="Generated This Month" value={kpis.generatedThisMonth} tone="green" />
        <KpiCard label="Report Modules" value={kpis.moduleCount} tone="blue" />
        <KpiCard
          label="Last Generated"
          value={kpis.lastGeneratedAt ? formatDate(kpis.lastGeneratedAt).split(',')[0] : '—'}
          detail={kpis.lastGeneratedAt ? formatDate(kpis.lastGeneratedAt).split(',')[1]?.trim() : 'No reports yet'}
          tone="amber"
        />
      </div>

      <Tabs defaultValue="modules">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="modules">Report Modules</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity ({recentActivity.length})</TabsTrigger>
          <TabsTrigger value="regulatory">Regulatory Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="mt-4 space-y-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search report modules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredCatalog.length === 0 ? (
            <EmptyState title="No modules found" message="Try a different search term." />
          ) : (
            filteredCatalog.map((category) => (
              <div key={category.id} className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold">{category.label}</h2>
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {category.modules.map((mod) => (
                    <Link key={mod.id} href={mod.href} className="group block">
                      <Card className="h-full transition-shadow hover:shadow-md hover:border-blue-500/40">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {mod.label}
                            </CardTitle>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" />
                          </div>
                          <CardDescription className="line-clamp-2">{mod.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-1.5">
                            {mod.reportTypes.map((type) => (
                              <Badge key={type} variant="secondary" className="text-xs font-normal">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-6">
          {byModule.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  Reports by Module
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byModule} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="module" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileDown className="h-4 w-4 text-blue-600" />
                Recent Report Activity
              </CardTitle>
              <CardDescription>
                Latest generated reports across QMS modules from Firestore.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <EmptyState
                  title="No reports generated yet"
                  message="Generate reports from any module below. Activity will appear here once reports are saved to Firestore."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-3 pr-4 font-medium">Report #</th>
                        <th className="pb-3 pr-4 font-medium">Module</th>
                        <th className="pb-3 pr-4 font-medium">Type</th>
                        <th className="pb-3 pr-4 font-medium">Generated By</th>
                        <th className="pb-3 pr-4 font-medium">Date</th>
                        <th className="pb-3 pr-4 font-medium">Records</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentActivity.map((row) => (
                        <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-3 pr-4">
                            <Link href={row.href} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                              {row.reportNumber}
                            </Link>
                          </td>
                          <td className="py-3 pr-4">{row.moduleLabel}</td>
                          <td className="py-3 pr-4 max-w-[200px] truncate">{row.reportType}</td>
                          <td className="py-3 pr-4">{row.generatedBy}</td>
                          <td className="py-3 pr-4 whitespace-nowrap">{formatDate(row.generatedAt)}</td>
                          <td className="py-3 pr-4">{row.totalRecords || '—'}</td>
                          <td className="py-3">
                            <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', statusTone(row.status))}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regulatory" className="mt-4 space-y-4">
          <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium">Regulatory &amp; Inspection Reports</p>
                <p className="text-xs text-muted-foreground mt-1">
                  These reports support GMP compliance, management review, and regulatory inspection readiness.
                  Generate from the linked module report center.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {REGULATORY_REPORT_TYPES.map((report) => (
              <Link key={report.title} href={report.href} className="group block">
                <Card className="h-full transition-shadow hover:shadow-md hover:border-blue-500/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        <FileText className="h-4 w-4 shrink-0" />
                        {report.title}
                      </CardTitle>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-blue-600" />
                    </div>
                    <Badge variant="outline" className="w-fit text-xs">{report.regulation}</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
