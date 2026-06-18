'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Package, Truck } from 'lucide-react';
import { listRecallsForRecoveryTracking } from '@/services/recallRecoveryService';
import type { RecallRecord } from '@/lib/recall-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { RecallRecoveryAccessGuard } from './recall-recovery-access-guard';
import { RecallStatusBadge, ClassificationBadge } from '@/components/recall/recall-sub-nav';
import { RecoveryProgressBar } from './recall-recovery-badges';

type ListVariant = 'recovery' | 'distribution';

export function RecallRecoveryListPage({ variant = 'recovery' }: { variant?: ListVariant }) {
  const [records, setRecords] = useState<RecallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await listRecallsForRecoveryTracking());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recalls');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      r.recall_number.toLowerCase().includes(q)
      || r.product_name.toLowerCase().includes(q)
      || r.batch_number.toLowerCase().includes(q));
  }, [records, search]);

  const title = variant === 'distribution' ? 'Recall Distribution Tracking' : 'Recall Recovery Tracking';
  const description = variant === 'distribution'
    ? 'Manage market and customer-wise product distribution for active recalls'
    : 'Track customer recovery, follow-ups and recall effectiveness';
  const defaultTab = variant === 'distribution' ? 'distribution' : 'recovery';

  return (
    <RecallRecoveryAccessGuard>
      <CpvPageHeader
        title={title}
        description={description}
        trail={[
          { label: 'QMS', href: '/dashboard' },
          { label: 'Product Recall', href: '/qms/recall' },
          { label: title },
        ]}
      />

      {loading && <LoadingSkeleton rows={6} />}
      {error && <ErrorCard title="Load Error" message={error} onRetry={load} />}
      {!loading && !error && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search recall number, product, batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recall #</TableHead>
                    <TableHead>Product / Batch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead className="min-w-[160px]">Recovery</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No active recalls found
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.recall_number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.product_name}</div>
                        <div className="text-xs text-muted-foreground">Batch {r.batch_number}</div>
                      </TableCell>
                      <TableCell><RecallStatusBadge status={r.recall_status} /></TableCell>
                      <TableCell><ClassificationBadge value={r.recall_classification} /></TableCell>
                      <TableCell>
                        <RecoveryProgressBar percent={r.recovery_percent || 0} />
                        <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                          {r.recovered_quantity}/{r.distributed_quantity} units
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/qms/recall/${r.id}/recovery?tab=${defaultTab}`}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                          {variant === 'distribution' ? <Truck className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                          Open
                          <ArrowRight className="h-3.5 w-3.5" />
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
    </RecallRecoveryAccessGuard>
  );
}
