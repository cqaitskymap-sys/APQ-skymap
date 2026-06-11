'use client';

import { ComplaintDetailView } from '@/components/complaints/complaint-detail-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useComplaint } from '@/hooks/use-complaint';

export default function ComplaintDetailPage({ params }: { params: { id: string } }) {
  const { record, loading, refresh } = useComplaint(params.id);
  if (loading) return <LoadingSpinner label="Loading complaint..." />;
  if (!record) return <p className="text-muted-foreground">Complaint not found.</p>;
  return <ComplaintDetailView record={record} onRefresh={refresh} />;
}
