'use client';

import { useState } from 'react';
import { Upload, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BatchAttachment } from '@/lib/admin/schemas';
import { uploadBatchAttachment, deleteBatchAttachment } from '@/lib/admin/batch-service';

interface BatchAttachmentsSectionProps {
  batchId: string;
  attachments: BatchAttachment[];
  canUpload: boolean;
  auditMeta: { userId: string; userName: string };
  onRefresh: () => void;
}

export function BatchAttachmentsSection({
  batchId, attachments, canUpload, auditMeta, onRefresh,
}: BatchAttachmentsSectionProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await uploadBatchAttachment(batchId, file, auditMeta);
    setUploading(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success('File uploaded');
      onRefresh();
    }
    e.target.value = '';
  };

  const handleDelete = async (att: BatchAttachment) => {
    const result = await deleteBatchAttachment(att, auditMeta);
    if (result.success) {
      toast.success('Attachment removed');
      onRefresh();
    } else toast.error(result.error || 'Delete failed');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Attachments</CardTitle>
        {canUpload && (
          <Button variant="outline" size="sm" disabled={uploading} asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-1" />{uploading ? 'Uploading...' : 'Upload'}
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" onChange={handleUpload} />
            </label>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments uploaded.</p>
        ) : (
          attachments.map((att) => (
            <div key={att.id} className="flex items-center justify-between p-2 border rounded text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <a href={att.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {att.fileName}
                </a>
                <span className="text-xs text-muted-foreground">({Math.round(att.fileSize / 1024)} KB)</span>
              </div>
              {canUpload && (
                <Button variant="ghost" size="icon" onClick={() => handleDelete(att)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
