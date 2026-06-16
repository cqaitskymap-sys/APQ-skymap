'use client';

import { useState } from 'react';
import { Upload, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFile, deleteFile } from '@/lib/storage';
import { RAW_MATERIAL_STORAGE_MODULE } from '@/lib/cpv-raw-material-monitoring';
import type { RawMaterialAttachment } from '@/lib/cpv-raw-material-monitoring';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export function AttachmentUploader({
  recordId,
  uploadedBy,
  attachments,
  onChange,
  disabled,
}: {
  recordId: string;
  uploadedBy: string;
  attachments: RawMaterialAttachment[];
  onChange: (files: RawMaterialAttachment[]) => void;
  disabled?: boolean;
}) {
  const [category, setCategory] = useState('COA');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !recordId) return;
    setUploading(true);
    try {
      const meta = await uploadFile({
        moduleName: RAW_MATERIAL_STORAGE_MODULE,
        documentId: recordId,
        file,
        fileName: file.name,
        uploadedBy,
      });
      if (!meta) {
        toast.error('Upload failed or Firebase not configured');
        return;
      }
      const entry: RawMaterialAttachment = {
        ...meta,
        category,
      };
      onChange([...attachments, entry]);
      toast.success('File uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (file: RawMaterialAttachment) => {
    try {
      await deleteFile(RAW_MATERIAL_STORAGE_MODULE, recordId, file.fileName);
      onChange(attachments.filter((a) => a.fileName !== file.fileName));
      toast.success('Attachment removed');
    } catch {
      toast.error('Failed to delete attachment');
    }
  };

  return (
    <div className="space-y-3">
      <Label>Attachments (COA, GRN, Test Reports)</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="COA">COA</SelectItem>
            <SelectItem value="GRN">GRN</SelectItem>
            <SelectItem value="Test Report">Test Report</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled || uploading || !recordId} asChild>
          <label>
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload'}
            <input type="file" className="hidden" onChange={(e) => void handleUpload(e)} accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx" />
          </label>
        </Button>
      </div>
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments uploaded.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li key={a.fileName} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 hover:underline">
                  {a.category ? `${a.category}: ` : ''}{a.fileName}
                </a>
              </div>
              {!disabled && (
                <Button size="icon" variant="ghost" onClick={() => void handleDelete(a)}><Trash2 className="h-4 w-4" /></Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
