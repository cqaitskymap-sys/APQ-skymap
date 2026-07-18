'use client';;
import { use } from "react";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DmsDetailView } from '@/components/dms/dms-detail-view';
import { useDocument } from '@/hooks/use-dms';

export default function DocumentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { id } = params;
  const { record, loading, refresh } = useDocument(id);

  if (loading) return <LoadingSpinner />;
  if (!record) return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">Document not found</p>
      <Link href="/qms/dms/library"><Button variant="link">Back to Library</Button></Link>
    </div>
  );

  return (
    <div className="space-y-4">
      <Link href="/qms/dms/library"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
      <DmsDetailView record={record} onRefresh={refresh} defaultTab="overview" />
    </div>
  );
}
