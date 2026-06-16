'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EsignSettings, EsignSettingFormData } from '@/lib/admin/schemas';

interface EsignPreviewCardProps {
  setting: Partial<EsignSettings | EsignSettingFormData>;
}

export function EsignPreviewCard({ setting }: EsignPreviewCardProps) {
  const statement = setting.signatureStatementText
    || `By signing electronically, I confirm: ${setting.signatureMeaning || 'this action'}`;

  return (
    <Card className="border-indigo-200 bg-indigo-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-indigo-900">E-Signature Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded border bg-white p-4 space-y-2">
          <p className="font-semibold text-slate-800">{setting.moduleName} — {setting.actionType}</p>
          {setting.showSignatureStatement && (
            <p className="text-xs text-slate-600 italic border-l-2 border-indigo-300 pl-3">{statement}</p>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <div><span className="text-muted-foreground">Meaning:</span> {setting.signatureMeaning}</div>
            <div><span className="text-muted-foreground">Password:</span> {setting.requirePasswordReAuthentication ? 'Required' : 'No'}</div>
            <div><span className="text-muted-foreground">Comment:</span> {setting.requireCommentReason ? 'Required' : 'No'}</div>
            <div><span className="text-muted-foreground">Session:</span> {setting.sessionTimeoutMinutes ?? 15} min</div>
          </div>
          <div className="border-t pt-2 mt-2 text-xs text-slate-500">
            <p>Name: _______________________</p>
            <p>Role: _______________________</p>
            <p>Date/Time: _______________________</p>
            <p>Status: Signed</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
