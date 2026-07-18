'use client';;
import { use } from "react";

import { CapaDetailView } from '@/components/capa/capa-detail-view';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useCapa } from '@/hooks/use-capa';

export default function CapaDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { record, loading, refresh } = useCapa(params.id);

  if (loading) return <LoadingSpinner label="Loading CAPA..." />;
  if (!record) return <p className="text-muted-foreground">CAPA record not found.</p>;

  return <CapaDetailView record={record} onRefresh={refresh} />;
}
