'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EbmrForm } from '@/components/ebmr-mgmt/ebmr-form';
import { createEbmr } from '@/lib/ebmr-mgmt-service';
import { useEbmrActor } from '@/hooks/use-ebmr-mgmt';
import { canCreateEbmr } from '@/lib/ebmr-mgmt-types';
import type { EbmrCreateInput } from '@/lib/ebmr-mgmt-schemas';

export default function CreateEbmrPage() {
  const router = useRouter();
  const actor = useEbmrActor();

  if (!canCreateEbmr(actor.role)) {
    return <p className="text-sm text-red-600">You do not have permission to create batch records.</p>;
  }

  const handleCreate = async (data: EbmrCreateInput) => {
    try {
      const rec = await createEbmr(data, actor);
      toast.success(`eBMR ${rec.ebmr_number} created`);
      router.push(`/qms/ebmr/${rec.id}/line-clearance`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create eBMR');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create Batch Record</h1>
        <p className="text-muted-foreground text-sm">Initialize a new Electronic Batch Manufacturing Record for injectable manufacturing</p>
      </div>
      <Card><CardHeader><CardTitle>Batch Header Information</CardTitle></CardHeader>
        <CardContent><EbmrForm onSubmit={handleCreate} submitLabel="Create & Start Line Clearance" /></CardContent></Card>
    </div>
  );
}
