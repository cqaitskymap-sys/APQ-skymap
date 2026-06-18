'use client';

import { useEffect, useState } from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PermissionMatrix } from '@/components/admin/roles/permission-matrix';
import { PERMISSION_PRESETS, emptyPermissionMatrix, type PermissionMatrixData } from '@/lib/permission-presets';

interface UserAccessControlProps {
  value: PermissionMatrixData;
  onChange: (permissions: PermissionMatrixData) => void;
  presetId?: string;
  onPresetChange?: (presetId: string) => void;
  readOnly?: boolean;
}

export function UserAccessControl({
  value,
  onChange,
  presetId,
  onPresetChange,
  readOnly,
}: UserAccessControlProps) {
  const [selectedPreset, setSelectedPreset] = useState(presetId || '');

  useEffect(() => {
    if (presetId) setSelectedPreset(presetId);
  }, [presetId]);

  const applyPreset = (id: string) => {
    setSelectedPreset(id);
    onPresetChange?.(id);
    const preset = PERMISSION_PRESETS.find((p) => p.id === id);
    if (preset) onChange(JSON.parse(JSON.stringify(preset.permissions)));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Permission Preset</Label>
        <div className="flex flex-wrap gap-2">
          <Select
            value={selectedPreset}
            onValueChange={applyPreset}
            disabled={readOnly}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Select a preset or customize below" />
            </SelectTrigger>
            <SelectContent>
              {PERMISSION_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedPreset('');
                onPresetChange?.('');
                onChange(emptyPermissionMatrix());
              }}
            >
              Clear Preset
            </Button>
          )}
        </div>
        {selectedPreset && (
          <p className="text-xs text-muted-foreground">
            {PERMISSION_PRESETS.find((p) => p.id === selectedPreset)?.description}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Module Permissions</Label>
        <PermissionMatrix
          permissions={value}
          onChange={onChange}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
