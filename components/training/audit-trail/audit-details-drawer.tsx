'use client';

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import type { TrainingAuditEntry } from '@/lib/training-audit-trail-records';
import { formatAuditDateTimeLocal } from '@/lib/training-audit-trail-records';
import { AuditActionBadge, AuditStatusBadge } from './audit-status-badge';
import { Separator } from '@/components/ui/separator';

interface AuditDetailsDrawerProps {
  entry: TrainingAuditEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm py-1.5">
      <span className="text-muted-foreground col-span-1">{label}</span>
      <span className="col-span-2 break-all">{value || '—'}</span>
    </div>
  );
}

export function AuditDetailsDrawer({ entry, open, onOpenChange }: AuditDetailsDrawerProps) {
  if (!entry) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AuditActionBadge action={entry.action} />
            Audit Event Details
          </SheetTitle>
          <SheetDescription>
            Immutable audit record — cannot be edited or deleted.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <DetailRow label="Audit ID" value={<span className="font-mono text-xs">{entry.audit_id}</span>} />
          <DetailRow label="Timestamp (UTC)" value={entry.timestamp} />
          <DetailRow label="Local Time" value={formatAuditDateTimeLocal(entry.timestamp)} />
          <DetailRow label="Status" value={<AuditStatusBadge status={entry.status} />} />
          <Separator />
          <DetailRow label="Module" value={entry.module} />
          <DetailRow label="Entity Type" value={entry.entity_type} />
          <DetailRow label="Entity ID" value={<span className="font-mono text-xs">{entry.entity_id}</span>} />
          <DetailRow label="Reference Number" value={entry.reference_number} />
          <Separator />
          <DetailRow label="Changed Field" value={entry.changed_field} />
          <DetailRow label="Previous Value" value={<pre className="text-xs whitespace-pre-wrap text-red-700">{entry.previous_value || '—'}</pre>} />
          <DetailRow label="New Value" value={<pre className="text-xs whitespace-pre-wrap text-green-700">{entry.new_value || '—'}</pre>} />
          <DetailRow label="Reason for Change" value={entry.reason_for_change} />
          <DetailRow label="Comments" value={entry.comments} />
          <Separator />
          <DetailRow label="Performed By" value={entry.performed_by_name} />
          <DetailRow label="Employee ID" value={entry.employee_id} />
          <DetailRow label="Role" value={entry.role} />
          <DetailRow label="Department" value={entry.department} />
          <Separator />
          <DetailRow label="IP Address" value={entry.ip_address} />
          <DetailRow label="Device" value={entry.device} />
          <DetailRow label="Browser" value={<span className="text-xs">{entry.browser?.slice(0, 80)}</span>} />
          <Separator />
          <DetailRow label="E-Sign Required" value={entry.electronic_signature_required ? 'Yes' : 'No'} />
          <DetailRow label="E-Sign Status" value={entry.electronic_signature_status || '—'} />
          <DetailRow label="Signature ID" value={entry.signature_id || '—'} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
