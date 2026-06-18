'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import { fetchRecallClosureDashboardData } from '@/services/recallClosureService';
import type { RecallRecord, RecallClosure } from '@/lib/recall-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { RecallClosureAccessGuard } from './recall-closure-access-guard';
import { RecallClosureReadinessBar, RecallClosureStatusBadge } from './recall-closure-ui';
import { ClassificationBadge, RecallStatusBadge } from '@/components/recall/recall-sub-nav';

type Row = RecallRecord & { closure?: RecallClosure | null };

export function RecallClosureListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecallClosureDashboardData();
      setRows(data.all);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.recall_number.toLowerCase().includes(q) || r.product_name.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <RecallClosureAccessGuard>
      <CpvPageHeader
        title="Recall Closure"
        description="Final closure review for product recall, recovery and regulatory actions"
        trail={[
          { label: 'QMS', href: '/dashboard' },
          { label: 'Product Recall', href: '/qms/recall' },
          { label: 'Recall Closure' },
        ]}
      />
      {loading && <LoadingSkeleton rows={6} />}
      {error && <ErrorCard title="Load Error" message={error} onRetry={load} />}
      {!loading && !error && (
        <div className="space-y-4">
          <Input placeholder="Search recall..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recall #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Closure</TableHead>
                    <TableHead className="min-w-[140px]">Readiness</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No recalls available for closure</TableCell></TableRow>
                  ) : filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.recall_number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.product_name}</div>
                        <ClassificationBadge value={r.recall_classification} />
                      </TableCell>
                      <TableCell><RecallStatusBadge status={r.recall_status} /></TableCell>
                      <TableCell><RecallClosureStatusBadge status={r.closure?.closure_status} /></TableCell>
                      <TableCell><RecallClosureReadinessBar percent={r.closure?.readiness_percent ?? 0} /></TableCell>
                      <TableCell className="text-right">
                        <Link href={`/qms/recall/${r.id}/closure`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                          <Lock className="h-4 w-4" />Open<ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </RecallClosureAccessGuard>
  );
}
