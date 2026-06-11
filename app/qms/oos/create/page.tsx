'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OosForm } from '@/components/oos/oos-form';
import { createOosRecord } from '@/lib/oos-service';
import { useOosActor } from '@/hooks/use-oos';
import type { OosCreateInput } from '@/lib/oos-schemas';
import { computeResultStatus } from '@/lib/oos-types';

export default function CreateOosPage() {
  const router = useRouter();
  const actor = useOosActor();

  const handleSubmit = async (data: OosCreateInput) => {
    try {
      const resultStatus = computeResultStatus(data.observed_result, data.spec_lower_limit, data.spec_upper_limit);
      const record = await createOosRecord(data, actor);
      if (resultStatus === 'OOS') {
        toast.success(`OOS ${record.oos_number} created — investigation workflow triggered`);
      } else {
        toast.success(`Record ${record.oos_number} saved — result within specification (Pass)`);
      }
      router.push(`/qms/oos/${record.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create OOS');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create OOS</h1>
        <p className="text-muted-foreground text-sm">Enter test results — OOS workflow auto-triggers when result is out of specification</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>OOS Investigation Form</CardTitle>
          <CardDescription>Critical test failures automatically block batch release. QA, QC Manager, and Head QA are notified on OOS detection.</CardDescription>
        </CardHeader>
        <CardContent><OosForm submitLabel="Save OOS Record" onSubmit={handleSubmit} /></CardContent>
      </Card>
    </div>
  );
}
