'use client';

import { useParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EbmrDetailView } from '@/components/ebmr-mgmt/ebmr-detail-view';
import { useEbmrItem } from '@/hooks/use-ebmr-mgmt';

export default function EbmrDetailPage() {
  const id = useParams().id as string;
  const { record, loading, refresh } = useEbmrItem(id);

  if (loading) return <LoadingSpinner />;
  if (!record) return <p className="text-muted-foreground">eBMR record not found.</p>;

  return <EbmrDetailView record={record} onRefresh={refresh} />;
}
