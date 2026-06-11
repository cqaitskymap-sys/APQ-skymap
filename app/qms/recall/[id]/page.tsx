'use client';

import { RecallDetailView } from '@/components/recall/recall-detail-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useRecall } from '@/hooks/use-recall';

export default function RecallDetailPage({ params }: { params: { id: string } }) {
  const { record, loading, refresh } = useRecall(params.id);
  if (loading) return <LoadingSpinner label="Loading recall..." />;
  if (!record) return <p className="text-muted-foreground">Recall not found.</p>;
  return <RecallDetailView record={record} onRefresh={refresh} />;
}
