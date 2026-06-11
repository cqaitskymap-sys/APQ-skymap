'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecallForm } from '@/components/recall/recall-form';
import { createRecall } from '@/lib/recall-service';
import { useRecallActor } from '@/hooks/use-recall';
import type { RecallCreateInput } from '@/lib/recall-schemas';
import { canCreateRecall, isRecallReadOnly } from '@/lib/recall-types';

export default function CreateRecallPage() {
  const router = useRouter();
  const actor = useRecallActor();
  const [saving, setSaving] = useState(false);
  if (isRecallReadOnly(actor.role) || !canCreateRecall(actor.role)) {
    return <p className="text-muted-foreground">You do not have permission to initiate recalls.</p>;
  }
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Initiate Product Recall</h1><p className="text-muted-foreground text-sm">Register voluntary, regulatory, or mock recall linked to batch and distribution</p></div>
      <Card><CardHeader><CardTitle>Recall Details</CardTitle></CardHeader><CardContent>
        <RecallForm defaultValues={{ recall_initiated_by_name: actor.name }} onSubmit={async (data: RecallCreateInput) => {
          try { setSaving(true); const r = await createRecall(data, actor); toast.success(`Recall ${r.recall_number} created`); router.push(`/qms/recall/${r.id}`); }
          catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
        }} onCancel={() => router.push('/qms/recall')} submitLabel="Create Recall" saving={saving} />
      </CardContent></Card>
    </div>
  );
}
