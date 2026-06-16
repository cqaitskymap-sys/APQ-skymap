'use client';

import type { DeviationAuditEntry } from '@/lib/deviation-audit-trail-records';
import { DeviationAuditActionBadge } from './deviation-audit-action-badge';
import { DeviationAuditUserBadge } from './deviation-audit-user-badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';

interface DeviationAuditTableProps {
  entries: DeviationAuditEntry[];
  compact?: boolean;
}

export function DeviationAuditTable({ entries, compact }: DeviationAuditTableProps) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No audit records match the current filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date Time</TableHead>
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
              <TableCell className="text-xs whitespace-nowrap">
                {e.date_time ? new Date(e.date_time).toLocaleString() : '—'}
              </TableCell>
              <TableCell><DeviationAuditActionBadge action={e.action_type} /></TableCell>
              {!compact && <TableCell className="text-xs">{e.module_name}</TableCell>}
              <TableCell className="text-xs font-mono">{e.field_name || '—'}</TableCell>
              <TableCell className="text-xs max-w-[200px]">
                {e.field_name ? (
                  <span>
                    {e.old_value && <span className="text-red-600">{e.old_value.slice(0, 40)}</span>}
                    {e.old_value && e.new_value && ' → '}
                    {e.new_value && <span className="text-green-700">{e.new_value.slice(0, 40)}</span>}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{e.action_description.slice(0, 60)}</span>
                )}
              </TableCell>
              <TableCell><DeviationAuditUserBadge name={e.changed_by_name} role={e.changed_by_role} /></TableCell>
              {!compact && (
                <TableCell className="text-xs text-muted-foreground">
                  {e.ip_address || '—'}<br />{e.device_info || '—'}
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
