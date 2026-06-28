'use client';

import { RefreshCw, Settings, TestTube, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LmsStatusBadge } from './status-badge';
import type { LmsConnection } from '@/lib/lms-types';
import { formatSyncDuration } from '@/lib/lms-types';

interface ConnectionCardProps {
  connection: LmsConnection;
  onTest: (id: string) => void;
  onSync: (id: string) => void;
  onEdit: (id: string) => void;
  syncing?: boolean;
  canSync?: boolean;
}

export function ConnectionCard({ connection, onTest, onSync, onEdit, syncing, canSync }: ConnectionCardProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">{connection.connection_name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{connection.lms_name}</p>
          </div>
          <LmsStatusBadge status={connection.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">ID:</span> {connection.connection_id}</div>
          <div><span className="text-muted-foreground">Auth:</span> {connection.authentication_type}</div>
          <div className="col-span-2 truncate"><span className="text-muted-foreground">URL:</span> {connection.base_url}</div>
          <div><span className="text-muted-foreground">Frequency:</span> {connection.sync_frequency}</div>
          <div><span className="text-muted-foreground">Mode:</span> {connection.sync_mode}</div>
        </div>
        <div className="text-xs text-muted-foreground">
          Last sync: {connection.last_sync ? new Date(connection.last_sync).toLocaleString() : 'Never'}
          {connection.next_sync && <> · Next: {new Date(connection.next_sync).toLocaleString()}</>}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Webhook className="h-3 w-3" />
          <span className="truncate">{connection.webhook_url}</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {canSync && (
            <>
              <Button size="sm" variant="outline" onClick={() => onTest(connection.id)} disabled={syncing}>
                <TestTube className="h-3.5 w-3.5 mr-1" /> Test
              </Button>
              <Button size="sm" onClick={() => onSync(connection.id)} disabled={syncing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sync
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => onEdit(connection.id)}>
            <Settings className="h-3.5 w-3.5 mr-1" /> Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { formatSyncDuration };
