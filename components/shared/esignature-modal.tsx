'use client';

import { useEffect, useState } from 'react';
import { PenLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/auth-context';
import { fetchActiveEsignSetting } from '@/lib/admin/esign-settings-service';
import { performEsign } from '@/lib/admin/esign-service';
import type { EsignRecord } from '@/lib/admin/schemas';

export interface ESignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleName: string;
  recordId: string;
  documentNumber?: string;
  actionType: string;
  signatureMeaning?: string;
  isTest?: boolean;
  onSuccess?: (record: EsignRecord) => void;
  onCancel?: () => void;
}

export function ESignatureModal({
  open, onOpenChange, moduleName, recordId, documentNumber, actionType,
  signatureMeaning, isTest, onSuccess, onCancel,
}: ESignatureModalProps) {
  const { user, profile } = useAuth();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settingLoading, setSettingLoading] = useState(true);
  const [statement, setStatement] = useState('');
  const [requirePassword, setRequirePassword] = useState(true);
  const [requireComment, setRequireComment] = useState(true);
  const [meaning, setMeaning] = useState(signatureMeaning || '');

  useEffect(() => {
    if (!open) return;
    setSettingLoading(true);
    fetchActiveEsignSetting(moduleName, actionType).then((s) => {
      if (s) {
        setRequirePassword(s.requirePasswordReAuthentication);
        setRequireComment(s.requireCommentReason);
        setMeaning(signatureMeaning || s.signatureMeaning);
        setStatement(s.showSignatureStatement
          ? s.signatureStatementText || `By signing electronically, I confirm: ${s.signatureMeaning}`
          : '');
      } else {
        setMeaning(signatureMeaning || 'I confirm this action');
        setStatement('By signing electronically, I confirm this action is accurate and attributable to me.');
      }
      setSettingLoading(false);
    });
  }, [open, moduleName, actionType, signatureMeaning]);

  const handleCancel = () => {
    onOpenChange(false);
    setPassword('');
    setReason('');
    setConfirmed(false);
    onCancel?.();
  };

  const handleSubmit = async () => {
    if (!user?.email) {
      toast.error('User session not found');
      return;
    }
    setSubmitting(true);
    const result = await performEsign({
      moduleName,
      recordId,
      documentNumber,
      actionType,
      signatureMeaning: meaning,
      password: requirePassword ? password : undefined,
      reasonComment: reason,
      confirmed,
      userId: user.uid,
      userName: profile?.full_name || profile?.email || user.email || 'User',
      userEmail: user.email,
      userRole: profile?.role || '',
      department: profile?.department || '',
      isTest,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error || 'E-signature failed');
      return;
    }

    toast.success(isTest ? 'Test e-signature recorded' : 'E-signature completed');
    if (result.record) onSuccess?.(result.record);
    handleCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v ? handleCancel() : onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-indigo-600" />
            {isTest ? 'Test E-Signature' : 'Electronic Signature'}
          </DialogTitle>
          <DialogDescription>
            {moduleName} · {actionType}
            {documentNumber && ` · ${documentNumber}`}
          </DialogDescription>
        </DialogHeader>

        {settingLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading signature requirements...</p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-slate-50 border p-3 text-xs text-slate-600">
              <p><strong>User:</strong> {profile?.full_name || user?.email}</p>
              <p><strong>Meaning:</strong> {meaning}</p>
              {statement && <p className="mt-2 italic border-l-2 border-indigo-300 pl-2">{statement}</p>}
            </div>

            <div className="space-y-2">
              <Label>User Email</Label>
              <Input value={user?.email || ''} disabled />
            </div>

            {requirePassword && (
              <div className="space-y-2">
                <Label>Password (re-authentication) *</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{requireComment ? 'Reason / Comment *' : 'Reason / Comment'}</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Enter reason for this signature"
              />
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="esign-confirm"
                checked={confirmed}
                onCheckedChange={(c) => setConfirmed(c === true)}
              />
              <Label htmlFor="esign-confirm" className="text-sm leading-snug">
                I confirm this electronic signature is legally equivalent to my handwritten signature
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !confirmed || settingLoading} className="bg-indigo-600 hover:bg-indigo-700">
            {submitting ? 'Signing...' : isTest ? 'Test Sign' : 'Sign Electronically'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
