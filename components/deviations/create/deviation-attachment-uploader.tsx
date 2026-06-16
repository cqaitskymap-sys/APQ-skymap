'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function DeviationAttachmentUploader({
  onUpload,
  disabled,
}: {
  onUpload: (file: File) => Promise<{ error?: string }>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const { error } = await onUpload(file);
    setUploading(false);
    if (error) toast.error(error);
    else toast.success(`${file.name} uploaded`);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-4">
      <Input
        ref={inputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.webp,image/*"
        className="max-w-xs"
        disabled={disabled || uploading}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
        <Upload className="mr-1 h-4 w-4" />
        {uploading ? 'Uploading...' : 'Upload Attachment'}
      </Button>
      <p className="w-full text-xs text-muted-foreground">PDF, Excel, Word, JPEG, PNG (max recommended 10 MB)</p>
    </div>
  );
}

export function AttachmentList({
  files,
  onRemove,
}: {
  files: { id: string; file_name: string }[];
  onRemove?: (id: string) => void;
}) {
  if (!files.length) return null;
  return (
    <ul className="space-y-2">
      {files.map((f) => (
        <li key={f.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="truncate">{f.file_name}</span>
          {onRemove && (
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onRemove(f.id)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
