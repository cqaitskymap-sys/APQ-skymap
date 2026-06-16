'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { DocumentNumberingAccessGuard } from '@/components/admin/document-numbering/document-numbering-access-guard';
import { DocumentNumberingDetailView } from '@/components/admin/document-numbering/document-numbering-detail-view';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { fetchDocumentNumberingById } from '@/lib/admin/document-numbering-service';
import type { DocumentNumbering } from '@/lib/admin/schemas';

function DocumentNumberingDetailContent() {
  const params = useParams();
  const id = params.id as string;
  const [format, setFormat] = useState<DocumentNumbering | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const record = await fetchDocumentNumberingById(id);
      if (!record) setError('Numbering format not found');
      setFormat(record);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error || !format) return <ErrorCard message={error || 'Not found'} onRetry={load} />;

  return <DocumentNumberingDetailView format={format} onRefresh={load} />;
}

export default function DocumentNumberingDetailPage() {
  return (
    <DocumentNumberingAccessGuard>
      <DocumentNumberingDetailContent />
    </DocumentNumberingAccessGuard>
  );
}
