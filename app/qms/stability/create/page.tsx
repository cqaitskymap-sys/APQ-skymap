'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StabilityForm } from '@/components/stability/stability-form';
import { createStabilityStudy } from '@/lib/stability-service';
import { useStabilityActor } from '@/hooks/use-stability';
import type { StudyCreateInput } from '@/lib/stability-schemas';
import { canCreateStudy, isStabilityReadOnly } from '@/lib/stability-types';

export default function CreateStabilityStudyPage() {
  const router = useRouter();
  const actor = useStabilityActor();
  const [saving, setSaving] = useState(false);

  if (isStabilityReadOnly(actor.role) || !canCreateStudy(actor.role)) {
    return <p className="text-muted-foreground">You do not have permission to create stability studies.</p>;
  }

  const onSubmit = async (data: StudyCreateInput) => {
    try {
      setSaving(true);
      const record = await createStabilityStudy(data, actor);
      toast.success(`Study ${record.stability_study_number} created`);
      router.push(`/qms/stability/${record.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create study');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Stability Study</h1>
        <p className="text-muted-foreground text-sm">Register a new GMP stability study linked to product and batch master</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Study Details</CardTitle></CardHeader>
        <CardContent>
          <StabilityForm
            onSubmit={onSubmit}
            onCancel={() => router.push('/qms/stability')}
            submitLabel="Create Study"
            saving={saving}
          />
        </CardContent>
      </Card>
    </div>
  );
}
