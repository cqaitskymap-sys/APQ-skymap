'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardStats, getAuditLogs } from '@/lib/admin/admin-service';
import { getAdminRecords } from '@/lib/admin/admin-service';
import { ADMIN_COLLECTIONS, ADMIN_ROLES } from '@/lib/admin/constants';
import type { AdminUser } from '@/lib/admin/schemas';

const COLORS = ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#64748b'];

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingApprovals: number;
  totalDepartments: number;
  totalProducts: number;
  openDeviations: number;
  openCapa: number;
  openOos: number;
  pendingPqr: number;
  pendingCpvReview: number;
  systemHealth: string;
  auditTrailCount: number;
}

export function AdminDashboardCharts() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [roleData, setRoleData] = useState<{ name: string; value: number }[]>([]);
  const [auditTrend, setAuditTrend] = useState<{ month: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, users, logs] = await Promise.all([
          getDashboardStats(),
          getAdminRecords<AdminUser>(ADMIN_COLLECTIONS.users),
          getAuditLogs(),
        ]);
        setStats(s);

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

        const monthMap: Record<string, number> = {};
        logs.forEach((log) => {
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
    { label: 'Total Departments', value: stats.totalDepartments, color: 'border-l-indigo-600' },
    { label: 'Total Products', value: stats.totalProducts, color: 'border-l-teal-600' },
    { label: 'Open Deviations', value: stats.openDeviations, color: 'border-l-orange-500' },
    { label: 'Open CAPA', value: stats.openCapa, color: 'border-l-red-500' },
    { label: 'Open OOS', value: stats.openOos, color: 'border-l-rose-600' },
    { label: 'Pending PQR', value: stats.pendingPqr, color: 'border-l-purple-600' },
    { label: 'Pending CPV Review', value: stats.pendingCpvReview, color: 'border-l-cyan-600' },
    { label: 'System Health', value: stats.systemHealth, color: 'border-l-green-500', isText: true },
    { label: 'Audit Trail Count', value: stats.auditTrailCount, color: 'border-l-blue-500' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {statCards.map((card) => (
          <Card key={card.label} className={`border-l-4 ${card.color}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
              <p className="text-xl font-bold mt-1">
                {card.isText ? card.value : Number(card.value).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

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
          <CardHeader><CardTitle className="text-base">Department-wise Pending Tasks</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[
                { dept: 'QA', tasks: 12 }, { dept: 'QC', tasks: 8 },
                { dept: 'Production', tasks: 15 }, { dept: 'Warehouse', tasks: 5 },
                { dept: 'Engineering', tasks: 7 },
              ]}>
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
          <CardHeader><CardTitle className="text-base">Pending Approval Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[
                { week: 'W1', count: 5 }, { week: 'W2', count: 8 },
                { week: 'W3', count: 6 }, { week: 'W4', count: 12 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
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
