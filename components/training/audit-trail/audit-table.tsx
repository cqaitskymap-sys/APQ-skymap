'use client';

import type { TrainingAuditEntry } from '@/lib/training-audit-trail-records';
import { formatAuditDateTimeLocal } from '@/lib/training-audit-trail-records';
import { AuditActionBadge, AuditStatusBadge } from './audit-status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface AuditTableProps {
  entries: TrainingAuditEntry[];
  compact?: boolean;
  onSelect?: (entry: TrainingAuditEntry) => void;
}

export function AuditTable({ entries, compact, onSelect }: AuditTableProps) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No audit records match the current filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            {!compact && <TableHead>Reference</TableHead>}
            <TableHead>Action</TableHead>
            {!compact && <TableHead>Module</TableHead>}
            <TableHead>Entity</TableHead>
            <TableHead>Field / Change</TableHead>
            <TableHead>User</TableHead>
            {!compact && <TableHead>Department</TableHead>}
            <TableHead>Status</TableHead>
            {onSelect && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id || e.audit_id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect?.(e)}>
              <TableCell className="text-xs whitespace-nowrap">{formatAuditDateTimeLocal(e.timestamp)}</TableCell>
              {!compact && (
                <TableCell className="text-xs font-mono text-blue-600">{e.reference_number || '—'}</TableCell>
              )}
              <TableCell><AuditActionBadge action={e.action} /></TableCell>
              {!compact && <TableCell className="text-xs">{e.module}</TableCell>}
              <TableCell className="text-xs font-mono">{e.entity_type || '—'}</TableCell>
              <TableCell className="text-xs max-w-[200px]">
                {e.changed_field ? (
                  <span>
                    <span className="text-muted-foreground">{e.changed_field}: </span>
                    {e.previous_value && <span className="text-red-600 line-through">{e.previous_value.slice(0, 30)}</span>}
                    {e.previous_value && e.new_value && ' → '}
                    {e.new_value && <span className="text-green-700">{e.new_value.slice(0, 30)}</span>}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{e.comments.slice(0, 50) || '—'}</span>
                )}
              </TableCell>
              <TableCell className="text-xs">
                <div>{e.performed_by_name}</div>
                {e.role && <div className="text-muted-foreground">{e.role}</div>}
              </TableCell>
              {!compact && <TableCell className="text-xs">{e.department || '—'}</TableCell>}
              <TableCell><AuditStatusBadge status={e.status} /></TableCell>
              {onSelect && (
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={(ev) => { ev.stopPropagation(); onSelect(e); }}>Details</Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
