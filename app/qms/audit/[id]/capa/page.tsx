'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AuditDetailView } from '@/components/audit-mgmt/audit-detail-view';
import { useAudit } from '@/hooks/use-audit-mgmt';

export default function AuditCapaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { record, loading, refresh } = useAudit(id);
  if (loading) return <LoadingSpinner />;
  if (!record) return <div className="text-center py-12"><p className="text-muted-foreground">Audit not found</p></div>;
  return (
    <div className="space-y-4">
      <Link href="/qms/audit/capa"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
      <AuditDetailView record={record} onRefresh={refresh} defaultTab="capa" />
    </div>
  );
}
