'use client';

import type { CcAuditEntry } from '@/lib/cc-audit-trail-records';
import { formatAuditDateTimeLocal } from '@/lib/cc-audit-trail-records';
import { CcAuditActionBadge } from './cc-audit-action-badge';
import { CcAuditUserBadge } from './cc-audit-user-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';

interface CcAuditTableProps {
  entries: CcAuditEntry[];
  compact?: boolean;
}

export function CcAuditTable({ entries, compact }: CcAuditTableProps) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No audit records match the current filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date Time</TableHead>
            {!compact && <TableHead>Change No</TableHead>}
            <TableHead>Action</TableHead>
            {!compact && <TableHead>Module</TableHead>}
            <TableHead>Field</TableHead>
            <TableHead>Old → New</TableHead>
            <TableHead>User</TableHead>
            {!compact && <TableHead>IP / Device</TableHead>}
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id || e.audit_id}>
              <TableCell className="text-xs whitespace-nowrap" title={e.date_time}>
                {formatAuditDateTimeLocal(e.date_time)}
              </TableCell>
              {!compact && (
                <TableCell className="text-xs font-mono text-blue-600">{e.change_control_number || '—'}</TableCell>
              )}
              <TableCell><CcAuditActionBadge action={e.action_type} /></TableCell>
              {!compact && <TableCell className="text-xs">{e.module_name}</TableCell>}
              <TableCell className="text-xs font-mono">{e.field_name || '—'}</TableCell>
              <TableCell className="text-xs max-w-[200px]">
                {e.field_name ? (
                  <span>
                    {e.old_value ? <span className="text-red-600">{String(e.old_value).slice(0, 40)}</span> : null}
                    {e.old_value && e.new_value ? ' → ' : null}
                    {e.new_value ? <span className="text-green-700">{String(e.new_value).slice(0, 40)}</span> : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{(e.action_description || '').slice(0, 60)}</span>
                )}
              </TableCell>
              <TableCell><CcAuditUserBadge name={e.changed_by_name} role={e.changed_by_role} /></TableCell>
              {!compact && (
                <TableCell className="text-xs text-muted-foreground">
                  {e.ip_address || '—'}<br />{e.device_info || '—'}
                  {e.browser_info ? <><br />{e.browser_info}</> : null}
                </TableCell>
              )}
              <TableCell><StatusBadge status={e.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
