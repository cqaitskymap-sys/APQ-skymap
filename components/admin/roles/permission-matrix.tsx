'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ROLE_MATRIX_MODULES, ROLE_MATRIX_ACTIONS } from '@/lib/admin/constants';

interface PermissionMatrixProps {
  permissions: Record<string, Record<string, boolean>>;
  onChange: (permissions: Record<string, Record<string, boolean>>) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function PermissionMatrix({ permissions, onChange, disabled, readOnly }: PermissionMatrixProps) {
  const locked = disabled || readOnly;

  const toggle = (mod: string, action: string) => {
    if (locked) return;
    const modPerms = { ...(permissions[mod] || {}) };
    modPerms[action] = !modPerms[action];
    onChange({ ...permissions, [mod]: modPerms });
  };

  const setModuleAll = (mod: string, value: boolean) => {
    if (locked) return;
    const modPerms: Record<string, boolean> = {};
    ROLE_MATRIX_ACTIONS.forEach((a) => { modPerms[a] = value; });
    onChange({ ...permissions, [mod]: modPerms });
  };

  const setActionAll = (action: string, value: boolean) => {
    if (locked) return;
    const next = { ...permissions };
    ROLE_MATRIX_MODULES.forEach((mod) => {
      next[mod] = { ...(next[mod] || {}), [action]: value };
    });
    onChange(next);
  };

  const selectAll = (value: boolean) => {
    if (locked) return;
    const next: Record<string, Record<string, boolean>> = {};
    ROLE_MATRIX_MODULES.forEach((mod) => {
      next[mod] = {};
      ROLE_MATRIX_ACTIONS.forEach((a) => { next[mod][a] = value; });
    });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => selectAll(true)} disabled={locked}>
            Select All
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => selectAll(false)} disabled={locked}>
            Clear All
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border max-h-[560px] bg-card">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
            <TableRow>
              <TableHead className="sticky left-0 z-30 bg-muted/95 min-w-[150px] font-semibold">
                Module
              </TableHead>
              {ROLE_MATRIX_ACTIONS.map((action) => (
                <TableHead key={action} className="text-center text-[11px] min-w-[70px] p-1.5 align-bottom">
                  <div className="flex flex-col items-center gap-1">
                    <span className="leading-tight">{action}</span>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-[10px]"
                        onClick={() => setActionAll(action, true)}
                        disabled={locked}
                        aria-label={`Select all ${action}`}
                      >
                        All
                      </Button>
                    )}
                  </div>
                </TableHead>
              ))}
              {!readOnly && (
                <TableHead className="text-center text-xs min-w-[60px]">Module</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROLE_MATRIX_MODULES.map((mod) => (
              <TableRow key={mod}>
                <TableCell className="sticky left-0 z-10 bg-background font-medium text-sm whitespace-nowrap">
                  {mod}
                </TableCell>
                {ROLE_MATRIX_ACTIONS.map((action) => (
                  <TableCell key={action} className="text-center p-1.5">
                    <Checkbox
                      checked={permissions[mod]?.[action] ?? false}
                      onCheckedChange={() => toggle(mod, action)}
                      disabled={locked}
                      aria-label={`${mod} ${action}`}
                    />
                  </TableCell>
                ))}
                {!readOnly && (
                  <TableCell className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs"
                      onClick={() => setModuleAll(mod, true)}
                      disabled={locked}
                      aria-label={`Select all actions for ${mod}`}
                    >
                      All
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Matrix covers module, menu, screen, API, export/import/print, approval, and electronic signature permissions.
      </p>
    </div>
  );
}
