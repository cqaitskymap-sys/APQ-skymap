'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function AttachmentUploader({
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
    <div className="flex flex-wrap items-center gap-2">
      <Input
        ref={inputRef}
        type="file"
        className="max-w-xs"
        disabled={disabled || uploading}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4 mr-1" />
        {uploading ? 'Uploading...' : 'Upload Attachment'}
      </Button>
    </div>
  );
}
