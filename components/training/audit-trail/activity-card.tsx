'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { TrainingAuditEntry } from '@/lib/training-audit-trail-records';
import { formatAuditDateTimeLocal } from '@/lib/training-audit-trail-records';
import { AuditActionBadge } from './audit-status-badge';

interface ActivityCardProps {
  entry: TrainingAuditEntry;
  onClick?: () => void;
}

export function ActivityCard({ entry, onClick }: ActivityCardProps) {
  return (
    <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={onClick}>
      <CardContent className="p-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <AuditActionBadge action={entry.action} />
            <span className="text-xs text-muted-foreground">{formatAuditDateTimeLocal(entry.timestamp)}</span>
          </div>
          <p className="text-sm font-medium truncate">{entry.performed_by_name}</p>
          <p className="text-xs text-muted-foreground truncate">{entry.module} · {entry.reference_number || entry.entity_id}</p>
        </div>
      </CardContent>
    </Card>
  );
}
