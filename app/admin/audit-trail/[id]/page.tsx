'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AuditTrailAccessGuard } from '@/components/admin/audit-trail/audit-trail-access-guard';
import { AuditTrailDetailView } from '@/components/admin/audit-trail/audit-trail-detail-view';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import {
  fetchAuditTrailById, fetchAuditTrailEntries, filterAuditTrailByRole,
} from '@/lib/admin/audit-trail-service';
import type { AuditTrailEntry } from '@/lib/admin/schemas';

function AuditTrailDetailContent() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const { role } = useAdminPermissions();
  const [entry, setEntry] = useState<AuditTrailEntry | null>(null);
  const [allEntries, setAllEntries] = useState<AuditTrailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [record, all] = await Promise.all([
        fetchAuditTrailById(id),
        fetchAuditTrailEntries(),
      ]);
      const scoped = filterAuditTrailByRole(all, role, user?.uid);
      setAllEntries(scoped);
      if (!record) {
        setError('Audit record not found');
      } else {
        const allowed = scoped.some((e) => e.id === record.id || e.auditId === record.auditId);
        if (!allowed) setError('You do not have permission to view this audit record');
        else setEntry(record);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, role, user?.uid]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !entry) return <ErrorCard message={error || 'Not found'} onRetry={load} />;

  return <AuditTrailDetailView entry={entry} allEntries={allEntries} />;
}

export default function AuditTrailDetailPage() {
  return (
    <AuditTrailAccessGuard>
      <AuditTrailDetailContent />
    </AuditTrailAccessGuard>
  );
}
