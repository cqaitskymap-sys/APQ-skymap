'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComplaintForm } from '@/components/complaints/complaint-form';
import { createComplaint } from '@/lib/complaint-service';
import { useComplaintActor } from '@/hooks/use-complaint';
import type { ComplaintCreateInput } from '@/lib/complaint-schemas';
import { canCreateComplaint, isComplaintReadOnly } from '@/lib/complaint-types';

export default function CreateComplaintPage() {
  const router = useRouter();
  const actor = useComplaintActor();
  const [saving, setSaving] = useState(false);
  if (isComplaintReadOnly(actor.role) || !canCreateComplaint(actor.role)) {
    return <p className="text-muted-foreground">You do not have permission to register complaints.</p>;
  }
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Register Complaint</h1><p className="text-muted-foreground text-sm">Record a market complaint for GMP investigation and CAPA linkage</p></div>
      <Card><CardHeader><CardTitle>Complaint Details</CardTitle></CardHeader><CardContent>
        <ComplaintForm onSubmit={async (data: ComplaintCreateInput) => {
          try { setSaving(true); const r = await createComplaint(data, actor); toast.success(`Complaint ${r.complaint_number} created`); router.push(`/qms/complaints/${r.id}`); }
          catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
        }} onCancel={() => router.push('/qms/complaints')} submitLabel="Register Complaint" saving={saving} />
      </CardContent></Card>
    </div>
  );
}
