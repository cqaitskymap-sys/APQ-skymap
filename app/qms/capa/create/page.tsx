'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CapaForm } from '@/components/capa/capa-form';
import { createCapa } from '@/lib/capa-service';
import { useCapaActor } from '@/hooks/use-capa';
import type { CapaCreateInput } from '@/lib/capa-schemas';
import { useState } from 'react';
import { isCapaReadOnly } from '@/lib/capa-types';

export default function CreateCapaPage() {
  const router = useRouter();
  const actor = useCapaActor();
  const [saving, setSaving] = useState(false);

  if (isCapaReadOnly(actor.role)) {
    return <p className="text-muted-foreground">You do not have permission to create CAPA records.</p>;
  }

  const onSubmit = async (data: CapaCreateInput) => {
    try {
      setSaving(true);
      const record = await createCapa({
        ...data,
        action_owner_name: data.action_owner,
      }, actor);
      toast.success(`CAPA ${record.capa_number} created`);
      router.push(`/qms/capa/${record.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create CAPA');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create CAPA</h1>
        <p className="text-muted-foreground text-sm">Register a new corrective or preventive action linked to QMS sources</p>
      </div>
      <Card>
        <CardHeader><CardTitle>CAPA Details</CardTitle></CardHeader>
        <CardContent>
          <CapaForm
            onSubmit={onSubmit}
            onCancel={() => router.push('/qms/capa')}
            submitLabel="Create CAPA"
            saving={saving}
          />
        </CardContent>
      </Card>
    </div>
  );
}
