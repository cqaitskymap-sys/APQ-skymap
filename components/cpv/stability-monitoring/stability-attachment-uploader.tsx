'use client';

import { useState } from 'react';
import { Upload, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFile, deleteFile } from '@/lib/storage';
import { STABILITY_STORAGE_MODULE } from '@/lib/cpv-stability-monitoring';
import type { StabilityAttachment } from '@/lib/cpv-stability-monitoring';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function StabilityAttachmentUploader({
  recordId,
  uploadedBy,
  attachments,
  onChange,
  disabled,
}: {
  recordId: string;
  uploadedBy: string;
  attachments: StabilityAttachment[];
  onChange: (files: StabilityAttachment[]) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !recordId) return;
    setUploading(true);
    try {
      const meta = await uploadFile({
        moduleName: STABILITY_STORAGE_MODULE,
        documentId: recordId,
        file,
        fileName: file.name,
        uploadedBy,
      });
      if (!meta) {
        toast.error('Upload failed');
        return;
      }
      const next: StabilityAttachment = {
        fileName: meta.fileName,
        fileUrl: meta.fileUrl,
        fileType: meta.fileType,
        fileSize: meta.fileSize,
        uploadedBy,
        uploadedAt: new Date().toISOString(),
        category: 'Stability Report',
      };
      onChange([...attachments, next]);
      toast.success('Attachment uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      await deleteFile(STABILITY_STORAGE_MODULE, recordId, fileName);
      onChange(attachments.filter((a) => a.fileName !== fileName));
      toast.success('Attachment removed');
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="space-y-3">
      <Label>Attachments</Label>
      <div className="flex flex-wrap gap-2">
        {attachments.map((a) => (
          <div key={a.fileName} className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
            <FileText className="h-4 w-4 text-blue-600" />
            <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline truncate max-w-[200px]">
              {a.fileName}
            </a>
            {!disabled && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(a.fileName)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <div>
          <input type="file" id="stability-upload" className="hidden" onChange={handleUpload} accept=".pdf,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg" />
          <Button variant="outline" size="sm" disabled={uploading} asChild>
            <label htmlFor="stability-upload" className="cursor-pointer gap-2">
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload Report'}
            </label>
          </Button>
        </div>
      )}
    </div>
  );
}
