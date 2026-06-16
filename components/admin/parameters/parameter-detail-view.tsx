'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { ParameterTypeBadge } from './parameter-type-badge';
import { CriticalityBadge } from './criticality-badge';
import { ProductLinkBadge } from './product-link-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import {
  canEditParameters, canEditQcParameters, canEditUtilityParameters, canViewCppParametersOnly,
} from '@/lib/permissions';
import type { Parameter } from '@/lib/admin/schemas';
import { fetchParameterById, fetchParameterAuditTrail } from '@/lib/admin/parameter-service';

export function ParameterDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { role } = useAdminPermissions();
  const canEdit = canEditParameters(role) || canEditQcParameters(role) || canEditUtilityParameters(role);
  const cppOnly = canViewCppParametersOnly(role);

  const [param, setParam] = useState<Parameter | null>(null);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const p = await fetchParameterById(id);
      if (!p) {
        setError('Parameter not found');
        return;
      }
      setParam(p);
      setAuditTrail(await fetchParameterAuditTrail(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton rows={2} />;
  if (error || !param) return <ErrorCard title="Not Found" message={error || 'Parameter not found'} />;

  if (cppOnly && param.parameterType !== 'CPP' && param.parameterType !== 'IPC' && param.parameterType !== 'Yield Parameter') {
    return <ErrorCard accessDenied message="You can only view CPP parameters." />;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push('/admin/parameters')}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back to Parameters
      </Button>

      <PageHeader
        title={param.parameterName}
        description={param.parameterId || param.parameterCode}
        basePath="/admin"
        actions={
          canEdit && !cppOnly ? (
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/admin/parameters/${id}/edit`}><Pencil className="h-4 w-4 mr-1" />Edit Parameter</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <ParameterTypeBadge type={param.parameterType} />
        <CriticalityBadge criticality={param.criticality} />
        <StatusBadge status={param.status} />
        <ProductLinkBadge product={param.productLink} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Parameter Profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Parameter Code', value: param.parameterCode },
            { label: 'Category', value: param.parameterCategory },
            { label: 'Process Stage', value: param.processStage },
            { label: 'Department', value: param.department },
            { label: 'Test Method / STP', value: param.testMethodStp },
            { label: 'Specification No', value: param.specificationNo },
            { label: 'Result Type', value: param.resultType },
            { label: 'Unit', value: param.unit },
            { label: 'Frequency', value: param.frequency },
            { label: 'Target Value', value: param.targetValue },
            { label: 'Lower Limit', value: param.lowerLimit },
            { label: 'Upper Limit', value: param.upperLimit },
            { label: 'Alert Limit Low', value: param.alertLimitLow },
            { label: 'Alert Limit High', value: param.alertLimitHigh },
            { label: 'Action Limit Low', value: param.actionLimitLow },
            { label: 'Action Limit High', value: param.actionLimitHigh },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{String(f.value ?? '-')}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Automation Rules</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'OOT Applicable', value: param.ootApplicable },
            { label: 'OOS Applicable', value: param.oosApplicable },
            { label: 'Auto Deviation', value: param.autoDeviationRequired },
            { label: 'Auto CAPA', value: param.autoCapaRequired },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="font-medium">{f.value ? 'Yes' : 'No'}</p>
            </div>
          ))}
          {param.remarks && (
            <div className="sm:col-span-2 md:col-span-4">
              <p className="text-xs text-muted-foreground">Remarks</p>
              <p className="font-medium">{param.remarks}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
        <CardContent>
          {auditTrail.length === 0 ? (
            <EmptyState title="No audit entries" />
          ) : (
            <div className="space-y-2">
              {auditTrail.map((entry, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 p-2 border rounded text-sm">
                  <span className="font-medium">{String(entry.action ?? '-')}</span>
                  <span className="text-xs text-muted-foreground">
                    {String(entry.userName ?? entry.actorName ?? '-')} · {String(entry.timestamp ?? entry.dateTime ?? '-')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
