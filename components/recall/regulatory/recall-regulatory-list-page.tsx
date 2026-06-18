'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { listRecallsForRegulatoryNotification } from '@/services/recallRegulatoryService';
import type { RecallRecord } from '@/lib/recall-types';
import { CpvPageHeader } from '@/components/cpv/product-master/cpv-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { RecallRegulatoryAccessGuard } from './recall-regulatory-access-guard';
import { RecallStatusBadge, ClassificationBadge } from '@/components/recall/recall-sub-nav';
import { RegulatoryNotificationStatusBadge } from './recall-regulatory-badges';

export function RecallRegulatoryListPage() {
  const [records, setRecords] = useState<RecallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await listRecallsForRegulatoryNotification());
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
      || (r.regulatory_authority || '').toLowerCase().includes(q));
  }, [records, search]);

  return (
    <RecallRegulatoryAccessGuard>
      <CpvPageHeader
        title="Recall Regulatory Notification"
        description="Track regulatory communication and approval for product recalls"
        trail={[
          { label: 'QMS', href: '/dashboard' },
          { label: 'Product Recall', href: '/qms/recall' },
          { label: 'Regulatory Notification' },
        ]}
      />

      {loading && <LoadingSkeleton rows={6} />}
      {error && <ErrorCard title="Load Error" message={error} onRetry={load} />}
      {!loading && !error && (
        <div className="space-y-4">
          <Input
            placeholder="Search recall, product, authority..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recall #</TableHead>
                    <TableHead>Product / Batch</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Authority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No recalls requiring regulatory notification
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.recall_number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.product_name}</div>
                        <div className="text-xs text-muted-foreground">Batch {r.batch_number}</div>
                      </TableCell>
                      <TableCell><ClassificationBadge value={r.recall_classification} /></TableCell>
                      <TableCell>{r.regulatory_authority || '—'}</TableCell>
                      <TableCell>{r.notification_due_date || '—'}</TableCell>
                      <TableCell>
                        <RegulatoryNotificationStatusBadge status={r.notification_status || (r.regulatory_notified ? 'Submitted' : 'Pending')} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/qms/recall/${r.id}/regulatory`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                          <ShieldAlert className="h-4 w-4" />Open<ArrowRight className="h-3.5 w-3.5" />
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
    </RecallRegulatoryAccessGuard>
  );
}
