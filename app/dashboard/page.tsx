'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle, Zap, Activity, Target, Package, TestTube } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { mockKPIs, mockBatchTrend, mockYieldTrend, mockOosTrend, mockDeviationsByType, mockCapaStatus, mockComplianceScore, mockRecentBatches, mockRecentDeviations, mockAiInsights } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

const KPICard = ({ icon: Icon, label, value, unit = '', trend, trendColor = 'text-green-600', subtext }: any) => (
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 800);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Skymap QMS Dashboard</h1>
        <p className="text-muted-foreground">Skymap Pharmaceuticals - GMP compliance, manufacturing metrics & regulatory intelligence</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Package} label="Total Batches (YTD)" value={mockKPIs.totalBatches} trend="+12% vs last year" subtext={`${mockKPIs.batchesMTD} this month`} />
        <KPICard icon={TrendingUp} label="Release Rate" value={mockKPIs.releaseRate} unit="%" trendColor="text-green-600" trend="↑ 2.1%" subtext="Target: 95%" />
        <KPICard icon={Target} label="Avg Yield" value={mockKPIs.avgYield} unit="%" subtext="Process optimized" />
        <KPICard icon={Activity} label="Compliance Score" value={mockKPIs.complianceScore} unit="%" trendColor="text-blue-600" trend="Excellent" />
      </div>

      {/* Quality Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard icon={AlertTriangle} label="Open Deviations" value={mockKPIs.openDeviations} trend="1 critical" trendColor="text-red-600" />
        <KPICard icon={TestTube} label="OOS Records" value={mockKPIs.openOos} trendColor="text-orange-600" trend="Under investigation" />
        <KPICard icon={CheckCircle} label="Active CAPAs" value={mockKPIs.openCapa} subtext="18 open, 32 closed YTD" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Batch Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch Manufacturing Trend</CardTitle>
            <CardDescription>Released, rejected, and in-process batches</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={mockBatchTrend}>
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
          </CardContent>
        </Card>

        {/* Yield Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Average Yield Trend</CardTitle>
            <CardDescription>Monthly manufacturing efficiency</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockYieldTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" domain={[95, 100]} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="yield" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} name="Yield %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Deviations by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deviations by Type</CardTitle>
            <CardDescription>YTD breakdown</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={mockDeviationsByType} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name} (${value})`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {mockDeviationsByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* CAPA Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CAPA Status</CardTitle>
            <CardDescription>Actions by stage</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={mockCapaStatus} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name} (${value})`} outerRadius={80} fill="#8884d8" dataKey="value">
                  {mockCapaStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* OOS Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">OOS Investigations</CardTitle>
            <CardDescription>Monthly trend</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={mockOosTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" fill="#ef4444" name="OOS Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Modules Score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Module Compliance Scores</CardTitle>
          <CardDescription>GMP compliance across all modules</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockComplianceScore} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" className="text-xs" domain={[0, 100]} />
              <YAxis dataKey="module" type="category" className="text-xs" width={120} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="score" fill="#3b82f6" name="Compliance %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Batches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Batches</CardTitle>
            <CardDescription>Latest manufacturing records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockRecentBatches.map((batch) => (
                <div key={batch.id} className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="space-y-1">
                    <p className="font-mono text-sm font-semibold">{batch.batch_number}</p>
                    <p className="text-xs text-muted-foreground">{batch.product_name}</p>
                  </div>
                  <Badge variant={batch.status === 'released' ? 'default' : batch.status === 'in_process' ? 'outline' : 'destructive'} className="text-xs capitalize">
                    {batch.status}
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4">View All Batches</Button>
          </CardContent>
        </Card>

        {/* Recent Deviations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Deviations</CardTitle>
            <CardDescription>Latest quality issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockRecentDeviations.map((dev) => (
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
            <Button variant="outline" size="sm" className="w-full mt-4">View All Deviations</Button>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-amber-500" />
            AI-Powered Insights
          </CardTitle>
          <CardDescription>Predictive analytics and anomaly detection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockAiInsights.map((insight) => (
              <div key={insight.id} className={cn(
                'p-4 rounded-lg border-l-4 bg-muted/50',
                insight.type === 'warning' ? 'border-l-amber-500' :
                insight.type === 'error' ? 'border-l-red-500' :
                insight.type === 'success' ? 'border-l-green-500' :
                'border-l-blue-500'
              )}>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-sm">{insight.title}</h4>
                  <Badge variant="outline" className="text-xs">{insight.confidence}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{insight.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
