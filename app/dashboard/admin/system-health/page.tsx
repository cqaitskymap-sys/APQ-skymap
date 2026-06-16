'use client';

import { useEffect, useState } from 'react';
import { Activity, RefreshCw, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getSystemHealthCheck } from '@/lib/admin/admin-service';
import { StatusBadge } from '@/components/admin/admin-data-table';

interface HealthCheck {
  name: string;
  status: 'Healthy' | 'Degraded' | 'Down';
  detail: string;
}

interface HealthResult {
  overall: string;
  checks: HealthCheck[];
  checkedAt: string;
}

const STATUS_ICONS = {
  Healthy: CheckCircle2,
  Degraded: AlertCircle,
  Down: XCircle,
};

const STATUS_COLORS = {
  Healthy: 'text-green-600',
  Degraded: 'text-amber-600',
  Down: 'text-red-600',
};

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(true);

  const check = async () => {
    setLoading(true);
    const result = await getSystemHealthCheck();
    setHealth(result);
    setLoading(false);
  };

  useEffect(() => { check(); }, []);

  return (
    <div>
      <AdminPageHeader
        title="System Health Check"
        description="Enterprise system health monitoring for Pharma QMS platform"
        actions={
          <Button variant="outline" onClick={check} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Run Health Check
          </Button>
        }
      />

      {loading && !health ? (
        <Skeleton className="h-64 w-full" />
      ) : health && (
        <div className="space-y-4">
          <Card className="border-l-4 border-l-blue-600">
            <CardContent className="p-6 flex items-center gap-4">
              <Activity className="h-10 w-10 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Overall System Health</p>
                <div className="flex items-center gap-3 mt-1">
                  <StatusBadge status={health.overall} />
                  <span className="text-xs text-muted-foreground">Checked at {new Date(health.checkedAt).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {health.checks.map((check) => {
              const Icon = STATUS_ICONS[check.status];
              return (
                <Card key={check.name}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${STATUS_COLORS[check.status]}`} />
                      {check.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <StatusBadge status={check.status} />
                    <p className="text-sm text-muted-foreground mt-2">{check.detail}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Health Check Details</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-0">
                {health.checks.map((check) => (
                  <div key={check.name} className="flex items-center justify-between py-3 border-b text-sm">
                    <span>{check.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">{check.detail}</span>
                      <Badge variant="outline">{check.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
