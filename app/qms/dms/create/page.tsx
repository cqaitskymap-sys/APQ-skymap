'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DmsForm } from '@/components/dms/dms-form';
import { createDocument } from '@/lib/dms-service';
import { useDmsActor } from '@/hooks/use-dms';
import type { DocumentCreateInput } from '@/lib/dms-schemas';
import { canCreateDocument } from '@/lib/dms-types';

export default function CreateDocumentPage() {
  const router = useRouter();
  const actor = useDmsActor();
  const [saving, setSaving] = useState(false);

  if (!canCreateDocument(actor.role)) {
    return <p className="text-muted-foreground">You do not have permission to create documents.</p>;
  }

  const handleSubmit = async (data: DocumentCreateInput) => {
    setSaving(true);
    try {
      const doc = await createDocument({ ...data, prepared_by_name: data.prepared_by_name || actor.name }, actor);
      toast.success(`Document ${doc.document_number} created`);
      router.push(`/qms/dms/${doc.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create Document</h1>
        <p className="text-muted-foreground text-sm">Document number will be auto-generated from admin numbering settings</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Document Information</CardTitle></CardHeader>
        <CardContent>
          <DmsForm
            defaultValues={{ prepared_by_name: actor.name }}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/qms/dms')}
            submitLabel="Create Document"
            saving={saving}
          />
        </CardContent>
      </Card>
    </div>
  );
}
