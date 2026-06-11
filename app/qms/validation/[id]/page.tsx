'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ValidationDetailView } from '@/components/validation-mgmt/validation-detail-view';
import { useValidation } from '@/hooks/use-validation-mgmt';

export default function ValidationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { record, loading, refresh } = useValidation(id);

  if (loading) return <LoadingSpinner />;
  if (!record) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">Validation record not found</p>
        <Link href="/qms/validation"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" />Back to Dashboard</Button></Link>
      </div>
    );
  }

  return <ValidationDetailView record={record} onRefresh={refresh} />;
}
