'use client';

import { cn } from '@/lib/utils';
import { distributionStatusColor } from '@/lib/controlled-distribution-types';
import { FileText, Users, Clock } from 'lucide-react';
import type { ControlledDistributionRecord } from '@/lib/controlled-distribution-types';

export function DistributionStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', distributionStatusColor(status), className)}>
      {status}
    </span>
  );
}

export function DistributionTable({ records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly, compact }: {
  records: ControlledDistributionRecord[];
  selectedIds?: string[];
  toggleSelect?: (id: string) => void;
  toggleSelectAll?: () => void;
  isReadOnly?: boolean;
  compact?: boolean;
}) {
  if (!records.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No distributions match filters.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {!isReadOnly && toggleSelect && (
              <th className="p-3 w-10"><input type="checkbox" onChange={toggleSelectAll} className="rounded" /></th>
            )}
            <th className="p-3 text-left font-medium">Distribution #</th>
            <th className="p-3 text-left font-medium">Document</th>
            <th className="p-3 text-left font-medium hidden md:table-cell">Type</th>
            <th className="p-3 text-left font-medium hidden lg:table-cell">Version</th>
            <th className="p-3 text-left font-medium">Status</th>
            <th className="p-3 text-left font-medium hidden xl:table-cell">Department</th>
            {!compact && <th className="p-3 text-left font-medium hidden xl:table-cell">Distribution Date</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              {!isReadOnly && toggleSelect && (
                <td className="p-3"><input type="checkbox" checked={selectedIds?.includes(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
              )}
              <td className="p-3 font-mono text-xs">{r.distribution_number}</td>
              <td className="p-3 max-w-[180px]">
                <p className="truncate font-medium">{r.document_title}</p>
                <p className="text-xs text-muted-foreground">{r.document_number}</p>
              </td>
              <td className="p-3 hidden md:table-cell text-muted-foreground">{r.document_type}</td>
              <td className="p-3 hidden lg:table-cell font-mono text-xs">{r.document_version}</td>
              <td className="p-3"><DistributionStatusBadge status={r.status} /></td>
              <td className="p-3 hidden xl:table-cell text-muted-foreground">{r.department || r.assigned_departments[0] || '—'}</td>
              {!compact && <td className="p-3 hidden xl:table-cell text-muted-foreground">{r.distribution_date || '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecipientSelector({ departments, roles, selectedDepts, selectedRoles, onDeptChange, onRoleChange }: {
  departments: string[];
  roles: string[];
  selectedDepts: string[];
  selectedRoles: string[];
  onDeptChange: (depts: string[]) => void;
  onRoleChange: (roles: string[]) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="text-sm font-medium mb-2 flex items-center gap-1"><Users className="h-4 w-4" /> Departments</p>
        <div className="rounded border p-2 max-h-40 overflow-y-auto space-y-1">
          {departments.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selectedDepts.includes(d)} onChange={(e) => {
                onDeptChange(e.target.checked ? [...selectedDepts, d] : selectedDepts.filter((x) => x !== d));
              }} />
              {d}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Roles</p>
        <div className="rounded border p-2 max-h-40 overflow-y-auto space-y-1">
          {roles.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selectedRoles.includes(r)} onChange={(e) => {
                onRoleChange(e.target.checked ? [...selectedRoles, r] : selectedRoles.filter((x) => x !== r));
              }} />
              {r.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DistributionHistory({ records }: { records: ControlledDistributionRecord[] }) {
  if (!records.length) return <p className="text-sm text-muted-foreground">No distribution history.</p>;
  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {records.map((r) => (
        <div key={r.id} className="rounded border px-3 py-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="font-mono text-xs">{r.distribution_number}</span>
            <DistributionStatusBadge status={r.status} />
          </div>
          <p className="text-muted-foreground mt-1">{r.document_number} v{r.document_version} · {r.distribution_type}</p>
          {r.withdrawn_reason && <p className="text-xs text-amber-700 mt-1">Withdrawn: {r.withdrawn_reason}</p>}
        </div>
      ))}
    </div>
  );
}

export function DistributionPreview({ record }: { record: Partial<ControlledDistributionRecord> }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
      <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-600" /><span className="font-medium">{record.document_title || '—'}</span></div>
      <p>Document: {record.document_number || '—'} · v{record.document_version || '—'}</p>
      <p>Type: {record.distribution_type || '—'} · Dept: {record.department || record?.assigned_departments?.[0] || '—'}</p>
      <p>Effective: {record.effective_date || '—'} · Expiry: {record.expiry_date || 'None'}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {record.acknowledgement_required && <span className="text-xs bg-amber-50 text-amber-700 rounded px-2 py-0.5">Ack Required</span>}
        {record.training_required && <span className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">Training Required</span>}
        {record.read_confirmation_required && <span className="text-xs bg-purple-50 text-purple-700 rounded px-2 py-0.5">Read Confirmation</span>}
      </div>
    </div>
  );
}

export function AuditTimeline({ entries }: { entries: Array<{ action: string; user: string; date: string }> }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No audit entries.</p>;
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {entries.map((e, i) => (
        <div key={i} className="rounded border px-3 py-2 text-sm flex gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div><p className="font-medium">{e.action}</p><p className="text-xs text-muted-foreground">{e.user} · {new Date(e.date).toLocaleString()}</p></div>
        </div>
      ))}
    </div>
  );
}

export { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
