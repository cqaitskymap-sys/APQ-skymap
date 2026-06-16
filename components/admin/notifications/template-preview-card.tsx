'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { previewNotificationTemplate } from '@/lib/admin/notification-settings-service';
import type { NotificationSetting, NotificationSettingFormData } from '@/lib/admin/schemas';

export function TemplatePreviewCard({ setting }: { setting: Partial<NotificationSetting | NotificationSettingFormData> }) {
  const preview = previewNotificationTemplate(setting as NotificationSetting);

  return (
    <Card className="border-sky-200 bg-sky-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-sky-900">Template Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Subject</p>
          <p className="font-medium bg-white border rounded p-2">{preview.subject || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Body</p>
          <p className="text-sm bg-white border rounded p-3 whitespace-pre-wrap">{preview.body || '—'}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Variables: {'{{documentNumber}}'}, {'{{moduleName}}'}, {'{{productName}}'}, {'{{batchNumber}}'}, {'{{assignedTo}}'}, {'{{dueDate}}'}, {'{{status}}'}, {'{{createdBy}}'}, {'{{siteName}}'}
        </p>
      </CardContent>
    </Card>
  );
}
