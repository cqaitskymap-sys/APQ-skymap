'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function OosAttachmentPlaceholder({
  onAdd,
  disabled,
  files,
}: {
  onAdd: (fileName: string) => Promise<void>;
  disabled?: boolean;
  files: { id: string; file_name: string }[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await onAdd(file.name);
      toast.success(`${file.name} queued (upload placeholder)`);
    } catch {
      toast.error('Failed to register attachment');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-4">
        <Input
          ref={inputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.webp,image/*"
          className="max-w-xs"
          disabled={disabled || busy}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" />
          {busy ? 'Adding...' : 'Add Attachment (Placeholder)'}
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          Attachment upload placeholder — files are registered for audit; full storage integration pending.
        </p>
      </div>
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{f.file_name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
