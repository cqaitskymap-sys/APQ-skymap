'use client';

import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { ModuleBadge } from '@/components/admin/workflows/module-badge';
import { ActionTypeBadge } from './action-type-badge';
import { AuditTimeline } from './audit-timeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AuditTrailEntry } from '@/lib/admin/schemas';
import { getRecordTimeline } from '@/lib/admin/audit-trail-service';

interface AuditTrailDetailViewProps {
  entry: AuditTrailEntry;
  allEntries?: AuditTrailEntry[];
}

function FieldRow({ label, value }: { label: string; value?: string | boolean }) {
  if (value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm sm:col-span-2 break-all font-mono text-slate-800">
        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
      </span>
    </div>
  );
}

export function AuditTrailDetailView({ entry, allEntries = [] }: AuditTrailDetailViewProps) {
  const recordTimeline = getRecordTimeline(allEntries, entry.recordId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={entry.auditId || 'Audit Entry'}
        description={`${entry.moduleName} · ${entry.actionType}`}
        basePath="/admin"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/audit-trail"><ArrowLeft className="h-4 w-4 mr-1" />Back to Audit Trail</Link>
          </Button>
        }
      />

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-900">
            Read-only audit record. Tamper-proof append-only log — cannot be edited or deleted from this interface.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <ActionTypeBadge action={entry.actionType} />
        <StatusBadge status={entry.status} />
        <ModuleBadge module={entry.moduleName} />
        {entry.eSignatureRequired && (
          <span className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-800">E-Signature</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Audit Identity</CardTitle></CardHeader>
          <CardContent>
            <FieldRow label="Audit ID" value={entry.auditId} />
            <FieldRow label="Date Time" value={new Date(entry.dateTime).toLocaleString()} />
            <FieldRow label="Module Name" value={entry.moduleName} />
            <FieldRow label="Collection" value={entry.collectionName} />
            <FieldRow label="Record ID" value={entry.recordId} />
            <FieldRow label="Document Number" value={entry.documentNumber} />
            <FieldRow label="Action Type" value={entry.actionType} />
            <FieldRow label="Description" value={entry.actionDescription} />
            <FieldRow label="Status" value={entry.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">User & Context</CardTitle></CardHeader>
          <CardContent>
            <FieldRow label="Changed By (ID)" value={entry.changedByUserId} />
            <FieldRow label="Changed By (Name)" value={entry.changedByUserName} />
            <FieldRow label="Role" value={entry.changedByRole} />
            <FieldRow label="Department" value={entry.department} />
            <FieldRow label="Reason for Change" value={entry.reasonForChange} />
            <FieldRow label="IP Address" value={entry.ipAddress} />
            <FieldRow label="Device" value={entry.deviceInfo} />
            <FieldRow label="Browser" value={entry.browserInfo} />
            <FieldRow label="Location" value={entry.location} />
            <FieldRow label="E-Sign Required" value={entry.eSignatureRequired} />
            <FieldRow label="E-Sign Status" value={entry.eSignatureStatus} />
          </CardContent>
        </Card>
      </div>

      {(entry.fieldName || entry.oldValue || entry.newValue) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Field Change</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FieldRow label="Field Name" value={entry.fieldName} />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Old Value</p>
              <pre className="text-xs bg-red-50 border border-red-100 rounded p-3 overflow-auto max-h-40">
                {String(entry.oldValue ?? '—')}
              </pre>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">New Value</p>
              <pre className="text-xs bg-green-50 border border-green-100 rounded p-3 overflow-auto max-h-40">
                {String(entry.newValue ?? '—')}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {recordTimeline.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Record Timeline</CardTitle></CardHeader>
          <CardContent>
            <AuditTimeline
              entries={recordTimeline}
              emptyMessage="No related record activity"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
