'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuditForm } from '@/components/audit-mgmt/audit-form';
import { createAudit } from '@/lib/audit-mgmt-service';
import { useAuditActor } from '@/hooks/use-audit-mgmt';
import type { AuditCreateInput } from '@/lib/audit-mgmt-schemas';
import { canCreateAudit } from '@/lib/audit-mgmt-types';

export default function CreateAuditPage() {
  const router = useRouter();
  const actor = useAuditActor();
  const [saving, setSaving] = useState(false);

  if (!canCreateAudit(actor.role)) {
    return <p className="text-muted-foreground">You do not have permission to create audits.</p>;
  }

  const handleSubmit = async (data: AuditCreateInput) => {
    setSaving(true);
    try {
      const audit = await createAudit({ ...data, lead_auditor_name: data.lead_auditor_name || actor.name }, actor);
      toast.success(`Audit ${audit.audit_number} created`);
      router.push(`/qms/audit/${audit.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create audit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create Audit</h1>
        <p className="text-muted-foreground text-sm">Audit number will be auto-generated</p>
      </div>
      <Card><CardHeader><CardTitle>Audit Information</CardTitle></CardHeader><CardContent>
        <AuditForm defaultValues={{ lead_auditor_name: actor.name }} onSubmit={handleSubmit}
          onCancel={() => router.push('/qms/audit')} submitLabel="Create Audit" saving={saving} />
      </CardContent></Card>
    </div>
  );
}
