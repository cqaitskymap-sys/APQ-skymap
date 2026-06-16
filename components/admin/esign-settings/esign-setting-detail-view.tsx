'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, PenLine, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { ModuleBadge } from '@/components/admin/workflows/module-badge';
import { EsignActionBadge } from './action-type-badge';
import { EsignPreviewCard } from './esign-preview-card';
import { ESignatureModal } from '@/components/shared/esignature-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditEsignSettings } from '@/lib/permissions';
import type { EsignSettings } from '@/lib/admin/schemas';
import { setEsignSettingStatus } from '@/lib/admin/esign-settings-service';

interface EsignSettingDetailViewProps {
  setting: EsignSettings;
  onRefresh: () => void;
}

export function EsignSettingDetailView({ setting, onRefresh }: EsignSettingDetailViewProps) {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditEsignSettings(role);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const toggleStatus = async () => {
    setLoading(true);
    const activate = setting.status !== 'Active';
    const result = await setEsignSettingStatus(
      setting.id!,
      setting,
      activate ? 'Active' : 'Inactive',
      auditMeta,
    );
    setLoading(false);
    if (result.success) {
      toast.success(activate ? 'Setting activated' : 'Setting deactivated');
      onRefresh();
    } else toast.error(result.error || 'Action failed');
    setConfirmDeactivate(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={setting.settingCode}
        description={`${setting.moduleName} · ${setting.actionType}`}
        basePath="/admin"
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
                <PenLine className="h-4 w-4 mr-1" />Test E-Signature
              </Button>
              {setting.status === 'Active' ? (
                <Button variant="outline" size="sm" onClick={() => setConfirmDeactivate(true)} disabled={loading}>
                  <UserX className="h-4 w-4 mr-1" />Deactivate
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={toggleStatus} disabled={loading}>
                  <UserCheck className="h-4 w-4 mr-1" />Activate
                </Button>
              )}
              <Button size="sm" asChild className="bg-indigo-600 hover:bg-indigo-700">
                <Link href={`/admin/esign-settings/${setting.id}/edit`}>
                  <Pencil className="h-4 w-4 mr-1" />Edit
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={setting.status} />
        <ModuleBadge module={setting.moduleName} />
        <EsignActionBadge action={setting.actionType} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">E-Sign Setting ID</span><span className="font-mono">{setting.esignSettingId}</span>
            <span className="text-muted-foreground">Signature Meaning</span><span>{setting.signatureMeaning}</span>
            <span className="text-muted-foreground">Password Required</span><span>{setting.requirePasswordReAuthentication ? 'Yes' : 'No'}</span>
            <span className="text-muted-foreground">Comment Required</span><span>{setting.requireCommentReason ? 'Yes' : 'No'}</span>
            <span className="text-muted-foreground">Role Verification</span><span>{setting.requireRoleVerification ? 'Yes' : 'No'}</span>
            <span className="text-muted-foreground">Department Verification</span><span>{setting.requireDepartmentVerification ? 'Yes' : 'No'}</span>
            <span className="text-muted-foreground">Session Timeout</span><span>{setting.sessionTimeoutMinutes} min</span>
            <span className="text-muted-foreground">Max Failed Attempts</span><span>{setting.maxFailedEsignAttempts}</span>
            <span className="text-muted-foreground">Lock After Failures</span><span>{setting.lockAccountAfterFailedAttempts ? 'Yes' : 'No'}</span>
            <span className="text-muted-foreground">Delegated Signature</span><span>{setting.allowDelegatedSignature ? 'Yes' : 'No'}</span>
            <span className="text-muted-foreground">Final Approval Sig.</span><span>{setting.requireFinalApprovalSignature ? 'Yes' : 'No'}</span>
          </CardContent>
        </Card>
        <EsignPreviewCard setting={setting} />
      </div>

      {setting.remarks && (
        <Card>
          <CardHeader><CardTitle className="text-base">Remarks</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{setting.remarks}</p></CardContent>
        </Card>
      )}

      <ESignatureModal
        open={testOpen}
        onOpenChange={setTestOpen}
        moduleName={setting.moduleName}
        recordId={setting.id || 'test'}
        actionType={setting.actionType}
        signatureMeaning={setting.signatureMeaning}
        isTest
        onSuccess={() => toast.success('Test signature recorded in audit trail')}
      />

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate e-signature setting?</AlertDialogTitle>
            <AlertDialogDescription>
              Workflows will not require this e-signature rule until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={toggleStatus}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
