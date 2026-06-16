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
      <div className="overflow-x-auto rounded-lg border max-h-[520px]">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900">
            <TableRow>
              <TableHead className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 min-w-[140px] font-semibold">
                Module
              </TableHead>
              {ROLE_MATRIX_ACTIONS.map((action) => (
                <TableHead key={action} className="text-center text-xs min-w-[72px] p-2">
                  <div className="flex flex-col items-center gap-1">
                    <span>{action}</span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="text-[10px] text-blue-600 hover:underline"
                        onClick={() => setActionAll(action, true)}
                        disabled={locked}
                      >
                        All
                      </button>
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
                <TableCell className="sticky left-0 z-10 bg-white dark:bg-slate-950 font-medium text-sm whitespace-nowrap">
                  {mod}
                </TableCell>
                {ROLE_MATRIX_ACTIONS.map((action) => (
                  <TableCell key={action} className="text-center p-2">
                    <Checkbox
                      checked={permissions[mod]?.[action] ?? false}
                      onCheckedChange={() => toggle(mod, action)}
                      disabled={locked}
                    />
                  </TableCell>
                ))}
                {!readOnly && (
                  <TableCell className="text-center">
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setModuleAll(mod, true)}
                      disabled={locked}
                    >
                      All
                    </button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
