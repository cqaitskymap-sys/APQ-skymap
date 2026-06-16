'use client';

import { useState } from 'react';
import { Upload, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PRODUCT_ATTACHMENT_TYPES } from '@/lib/admin/constants';
import type { ProductAttachment } from '@/lib/admin/schemas';
import {
  uploadProductAttachment, deleteProductAttachment,
} from '@/lib/admin/product-service';

interface ProductAttachmentsSectionProps {
  productId: string;
  attachments: ProductAttachment[];
  canUpload: boolean;
  auditMeta: { userId: string; userName: string };
  onRefresh: () => void;
}

export function ProductAttachmentsSection({
  productId, attachments, canUpload, auditMeta, onRefresh,
}: ProductAttachmentsSectionProps) {
  const [type, setType] = useState<ProductAttachment['attachmentType']>('specification');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await uploadProductAttachment(productId, file, type, auditMeta);
    setUploading(false);
    if (result.error) toast.error(result.error);
    else {
      toast.success('File uploaded');
      onRefresh();
    }
    e.target.value = '';
  };

  const handleDelete = async (att: ProductAttachment) => {
    const result = await deleteProductAttachment(att, auditMeta);
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
          <div className="flex items-center gap-2">
            <Select value={type} onValueChange={(v) => setType(v as ProductAttachment['attachmentType'])}>
              <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_ATTACHMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t === 'stp' ? 'STP' : t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={uploading} asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-1" />{uploading ? 'Uploading...' : 'Upload'}
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleUpload} />
              </label>
            </Button>
          </div>
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
                <span className="text-xs text-muted-foreground">({att.attachmentType})</span>
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
