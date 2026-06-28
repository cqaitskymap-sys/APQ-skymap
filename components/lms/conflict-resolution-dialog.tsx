'use client';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ConflictRecord } from '@/lib/lms-types';
import { resolveConflict } from '@/lib/lms-sync-service';
import type { LmsActor } from '@/lib/lms-types';
import { toast } from 'sonner';

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: ConflictRecord[];
  actor: LmsActor;
  onResolved: () => void;
}

export function ConflictResolutionDialog({ open, onOpenChange, conflicts, actor, onResolved }: ConflictResolutionDialogProps) {
  const handleResolve = async (conflict: ConflictRecord, resolution: 'keep_existing' | 'use_incoming') => {
    try {
      await resolveConflict(conflict, resolution, actor);
      toast.success('Conflict resolved');
      onResolved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to resolve conflict');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conflict Resolution ({conflicts.length})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {conflicts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conflicts detected.</p>
          ) : conflicts.map((c) => (
            <div key={c.id} className="rounded-lg border p-3 space-y-2 text-sm">
              <p className="font-medium">{c.entityType} — {c.externalId}</p>
              <p className="text-xs text-muted-foreground">Match key: {c.matchKey}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/50 p-2 rounded">
                  <p className="font-semibold mb-1">Existing</p>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(c.existingData, null, 1).slice(0, 200)}</pre>
                </div>
                <div className="bg-muted/50 p-2 rounded">
                  <p className="font-semibold mb-1">Incoming</p>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(c.incomingData, null, 1).slice(0, 200)}</pre>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleResolve(c, 'keep_existing')}>Keep Existing</Button>
                <Button size="sm" onClick={() => handleResolve(c, 'use_incoming')}>Use Incoming</Button>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
