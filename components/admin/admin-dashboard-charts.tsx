'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getDashboardStats, getRecentAdminActivities } from '@/lib/admin/admin-service';
import { getAdminRecords } from '@/lib/admin/admin-service';
import { ADMIN_COLLECTIONS, ADMIN_ROLES } from '@/lib/admin/constants';
import type { AdminUser } from '@/lib/admin/schemas';
import { StatusBadge } from './admin-data-table';

const COLORS = ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#64748b'];

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingApprovals: number;
  failedLoginAttempts: number;
  openAuditLogs: number;
  systemHealth: string;
  firebaseStatus: string;
  backupStatus: string;
  openDeviations: number;
  openCapa: number;
  openOos: number;
  pendingPqr: number;
  pendingCpvReview: number;
  auditTrailCount: number;
  firebaseLatencyMs?: number;
}

interface RecentActivity {
  id?: string;
  dateTime: string;
  userName: string;
  module: string;
  action: string;
  recordId: string;
}

export function AdminDashboardCharts() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [roleData, setRoleData] = useState<{ name: string; value: number }[]>([]);
  const [deptPending, setDeptPending] = useState<{ dept: string; tasks: number }[]>([]);
  const [auditTrend, setAuditTrend] = useState<{ month: string; count: number }[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, users, activities] = await Promise.all([
          getDashboardStats(),
          getAdminRecords<AdminUser>(ADMIN_COLLECTIONS.users),
          getRecentAdminActivities(8),
        ]);
        setStats(s);
        setRecentActivities(activities);

        const roleCounts: Record<string, number> = {};
        users.forEach((u) => {
          const r = u.role || 'Unknown';
          roleCounts[r] = (roleCounts[r] || 0) + 1;
        });
        setRoleData(
          Object.entries(roleCounts).map(([name, value]) => ({
            name: ADMIN_ROLES.find((r) => r.id === name)?.name || name.replace(/_/g, ' '),
            value,
          }))
        );

        const deptCounts: Record<string, number> = {};
        users.filter((u) => u.userStatus === 'Pending Approval').forEach((u) => {
          const d = u.department || 'Other';
          deptCounts[d] = (deptCounts[d] || 0) + 1;
        });
        setDeptPending(
          Object.entries(deptCounts).map(([dept, tasks]) => ({ dept, tasks }))
            .concat(deptCounts.length === 0 ? [{ dept: 'None', tasks: 0 }] : [])
        );

        const monthMap: Record<string, number> = {};
        activities.forEach((log) => {
          if (!log.dateTime) return;
          const month = new Date(log.dateTime).toLocaleString('default', { month: 'short', year: '2-digit' });
          monthMap[month] = (monthMap[month] || 0) + 1;
        });
        setAuditTrend(Object.entries(monthMap).slice(0, 6).map(([month, count]) => ({ month, count })));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72 w-full" />)}
      </div>
    );
  }

  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, color: 'border-l-blue-600' },
    { label: 'Active Users', value: stats.activeUsers, color: 'border-l-green-600' },
    { label: 'Inactive Users', value: stats.inactiveUsers, color: 'border-l-slate-400' },
    { label: 'Pending Approvals', value: stats.pendingApprovals, color: 'border-l-amber-500' },
    { label: 'Failed Logins', value: stats.failedLoginAttempts, color: 'border-l-red-500' },
    { label: 'Open Audit Logs', value: stats.openAuditLogs, color: 'border-l-indigo-600' },
    { label: 'System Health', value: stats.systemHealth, color: 'border-l-green-500', isText: true },
    { label: 'Firebase Status', value: stats.firebaseStatus, color: 'border-l-cyan-600', isText: true },
    { label: 'Backup Status', value: stats.backupStatus, color: 'border-l-purple-600', isText: true },
    { label: 'Open Deviations', value: stats.openDeviations, color: 'border-l-orange-500' },
    { label: 'Open CAPA', value: stats.openCapa, color: 'border-l-red-500' },
    { label: 'Pending PQR', value: stats.pendingPqr, color: 'border-l-violet-600' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {statCards.map((card) => (
          <Card key={card.label} className={`border-l-4 ${card.color}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
              <p className="text-lg font-bold mt-1 truncate">
                {card.isText ? (
                  <StatusBadge status={String(card.value)} />
                ) : (
                  Number(card.value).toLocaleString()
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Admin Activities</CardTitle></CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No recent activities</p>
          ) : (
            <div className="space-y-2">
              {recentActivities.map((act, i) => (
                <div key={act.id || i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg text-sm">
                  <div>
                    <p className="font-medium">{act.action} — {act.module}</p>
                    <p className="text-xs text-muted-foreground">{act.userName} · {act.recordId}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {act.dateTime ? new Date(act.dateTime).toLocaleString() : '-'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">User Role Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={roleData.length ? roleData : [{ name: 'No Data', value: 1 }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {(roleData.length ? roleData : [{ name: 'No Data', value: 1 }]).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Department-wise Pending Approvals</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={deptPending}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dept" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="tasks" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Audit Events</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={auditTrend.length ? auditTrend : [{ month: 'N/A', count: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0891b2" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">QMS Open Items</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats ? [
                { item: 'Deviations', count: stats.openDeviations },
                { item: 'CAPA', count: stats.openCapa },
                { item: 'OOS', count: stats.openOos },
                { item: 'PQR', count: stats.pendingPqr },
                { item: 'CPV', count: stats.pendingCpvReview },
              ] : []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="item" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
