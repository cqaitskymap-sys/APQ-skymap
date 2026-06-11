'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CcForm } from '@/components/change-control/cc-form';
import { createChangeControl } from '@/lib/change-control-service';
import { useCcActor } from '@/hooks/use-change-control';
import type { ChangeCreateInput } from '@/lib/change-control-schemas';
import { canCreateChange, isCcReadOnly } from '@/lib/change-control-types';

export default function CreateChangeControlPage() {
  const router = useRouter();
  const actor = useCcActor();
  const [saving, setSaving] = useState(false);

  if (isCcReadOnly(actor.role) || !canCreateChange(actor.role)) {
    return <p className="text-muted-foreground">You do not have permission to create change controls.</p>;
  }

  const onSubmit = async (data: ChangeCreateInput) => {
    try {
      setSaving(true);
      const record = await createChangeControl(data, actor);
      toast.success(`Change ${record.change_control_number} created`);
      router.push(`/qms/change-control/${record.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create change control');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Change Control</h1>
        <p className="text-muted-foreground text-sm">Initiate a GMP change control for process, equipment, utility, document, or system changes</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Change Control Details</CardTitle></CardHeader>
        <CardContent>
          <CcForm
            defaultValues={{ initiated_by_name: actor.name }}
            onSubmit={onSubmit}
            onCancel={() => router.push('/qms/change-control')}
            submitLabel="Create Change Control"
            saving={saving}
          />
        </CardContent>
      </Card>
    </div>
  );
}
