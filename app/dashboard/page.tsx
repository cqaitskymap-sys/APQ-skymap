'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, AlertTriangle, CheckCircle, Zap, Activity, Target, Package, TestTube } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchExecutiveDashboardData, type ExecutiveDashboardData } from '@/lib/executive-dashboard-service';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';

const KPICard = ({
  icon: Icon,
  label,
  value,
  unit = '',
  trend,
  trendColor = 'text-green-600',
  subtext,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  trendColor?: string;
  subtext?: string;
}) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
          <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        {trend && <Badge variant="outline" className={cn('text-xs', trendColor)}>{trend}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}{unit}</p>
      {subtext && <p className="text-xs text-muted-foreground mt-2">{subtext}</p>}
    </CardContent>
  </Card>
);

function ChartEmpty({ message = 'No data available yet' }: { message?: string }) {
  return (
    <div className="flex h-[250px] items-center justify-center">
      <EmptyState title="No data" message={message} />
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchExecutiveDashboardData();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skymap QMS Dashboard</h1>
          <p className="text-muted-foreground">Loading live metrics from your QMS data...</p>
        </div>
        <LoadingSkeleton rows={2} />
      </div>
    );
  }

  if (!data) return null;

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Skymap QMS Dashboard</h1>
        <p className="text-muted-foreground">Skymap Pharmaceuticals — live GMP compliance, manufacturing metrics &amp; regulatory intelligence</p>
      </div>

      {data.error && <ErrorCard message={data.error} onRetry={load} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Package}
          label="Total Batches (YTD)"
          value={kpis.totalBatches}
          trend={kpis.releaseRateTrend ?? undefined}
          subtext={`${kpis.batchesMTD} this month`}
        />
        <KPICard
          icon={TrendingUp}
          label="Release Rate"
          value={kpis.releaseRate}
          unit="%"
          trendColor="text-green-600"
          trend={kpis.releaseRate >= 95 ? 'On target' : 'Below 95% target'}
          subtext="Target: 95%"
        />
        <KPICard
          icon={Target}
          label="Avg Yield"
          value={kpis.avgYield || '—'}
          unit={kpis.avgYield ? '%' : ''}
          subtext={kpis.avgYield ? 'From yield monitoring records' : 'No yield data recorded'}
        />
        <KPICard
          icon={Activity}
          label="Compliance Score"
          value={kpis.complianceScore || '—'}
          unit={kpis.complianceScore ? '%' : ''}
          trendColor="text-blue-600"
          trend={kpis.complianceScore >= 90 ? 'Strong' : kpis.complianceScore ? 'Needs attention' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          icon={AlertTriangle}
          label="Open Deviations"
          value={kpis.openDeviations}
          trend={kpis.criticalDeviations ? `${kpis.criticalDeviations} critical` : undefined}
          trendColor="text-red-600"
        />
        <KPICard
          icon={TestTube}
          label="OOS Records"
          value={kpis.openOos}
          trendColor="text-orange-600"
          trend={kpis.openOos ? 'Under investigation' : 'No open records'}
        />
        <KPICard
          icon={CheckCircle}
          label="Active CAPAs"
          value={kpis.openCapa}
          subtext={`${kpis.openCapa} open, ${kpis.closedCapaYtd} closed YTD`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch Manufacturing Trend</CardTitle>
            <CardDescription>Released, rejected, and in-process batches</CardDescription>
          </CardHeader>
          <CardContent>
            {data.batchTrend.some((r) => r.released || r.rejected || r.inProcess) ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.batchTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Area type="monotone" dataKey="released" stackId="1" stroke="#10b981" fill="#10b98133" name="Released" />
                  <Area type="monotone" dataKey="rejected" stackId="1" stroke="#ef4444" fill="#ef444433" name="Rejected" />
                  <Area type="monotone" dataKey="inProcess" stackId="1" stroke="#3b82f6" fill="#3b82f633" name="In Process" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="Register batches in CPV Batch Registration to see manufacturing trends." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Average Yield Trend</CardTitle>
            <CardDescription>Monthly manufacturing efficiency</CardDescription>
          </CardHeader>
          <CardContent>
            {data.yieldTrend.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.yieldTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="yield" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} name="Yield %" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="Record yield monitoring data to see efficiency trends." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deviations by Type</CardTitle>
            <CardDescription>YTD breakdown</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {data.deviationsByType.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={data.deviationsByType} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name} (${value})`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {data.deviationsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No deviation records found." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CAPA Status</CardTitle>
            <CardDescription>Actions by stage</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {data.capaStatus.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={data.capaStatus} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name} (${value})`} outerRadius={80} fill="#8884d8" dataKey="value">
                    {data.capaStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No CAPA records found." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">OOS Investigations</CardTitle>
            <CardDescription>Monthly trend</CardDescription>
          </CardHeader>
          <CardContent>
            {data.oosTrend.some((r) => r.count > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.oosTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="count" fill="#ef4444" name="OOS Count" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No OOS records found." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Module Compliance Scores</CardTitle>
          <CardDescription>GMP compliance across active modules</CardDescription>
        </CardHeader>
        <CardContent>
          {data.complianceScores.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.complianceScores} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" domain={[0, 100]} />
                <YAxis dataKey="module" type="category" className="text-xs" width={120} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="score" fill="#3b82f6" name="Compliance %" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty message="Compliance scores appear once module data is recorded." />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Batches</CardTitle>
            <CardDescription>Latest manufacturing records</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentBatches.length ? (
              <div className="space-y-3">
                {data.recentBatches.map((batch) => (
                  <div key={batch.id} className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <p className="font-mono text-sm font-semibold">{batch.batch_number}</p>
                      <p className="text-xs text-muted-foreground">{batch.product_name}</p>
                    </div>
                    <Badge variant={batch.status === 'released' ? 'default' : batch.status === 'in_process' ? 'outline' : 'destructive'} className="text-xs capitalize">
                      {batch.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <ChartEmpty message="No batch records found." />
            )}
            <Button variant="outline" size="sm" className="w-full mt-4" asChild>
              <Link href="/cpv/batch-registration">View All Batches</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Deviations</CardTitle>
            <CardDescription>Latest quality issues</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentDeviations.length ? (
              <div className="space-y-3">
                {data.recentDeviations.map((dev) => (
                  <div key={dev.id} className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="space-y-1">
                      <p className="font-mono text-sm font-semibold">{dev.deviation_number}</p>
                      <p className="text-xs text-muted-foreground">{dev.title}</p>
                    </div>
                    <Badge variant={dev.deviation_type === 'critical' ? 'destructive' : dev.deviation_type === 'major' ? 'outline' : 'secondary'} className="text-xs capitalize">
                      {dev.deviation_type}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <ChartEmpty message="No deviation records found." />
            )}
            <Button variant="outline" size="sm" className="w-full mt-4" asChild>
              <Link href="/qms/deviation">View All Deviations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-amber-500" />
            Active Alerts &amp; Insights
          </CardTitle>
          <CardDescription>Live alerts from CPV, deviations, OOS, and CAPA modules</CardDescription>
        </CardHeader>
        <CardContent>
          {data.alerts.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.alerts.map((insight) => (
                <div
                  key={insight.id}
                  className={cn(
                    'p-4 rounded-lg border-l-4 bg-muted/50',
                    insight.type === 'warning' ? 'border-l-amber-500' :
                    insight.type === 'error' ? 'border-l-red-500' :
                    insight.type === 'success' ? 'border-l-green-500' :
                    'border-l-blue-500',
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm">{insight.title}</h4>
                    <Badge variant="outline" className="text-xs">{insight.module}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <ChartEmpty message="No active alerts. All systems operating within limits." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
