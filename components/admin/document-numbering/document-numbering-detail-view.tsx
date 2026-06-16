'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Play, RotateCcw, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/dashboard/page-header';
import { StatusBadge } from '@/components/admin/dashboard/status-badge';
import { ModuleBadge } from '@/components/admin/workflows/module-badge';
import { ResetFrequencyBadge } from './reset-frequency-badge';
import { FormatBuilder } from './format-builder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { canEditDocumentNumbering } from '@/lib/permissions';
import type { DocumentNumbering, DocumentNumberingFormData } from '@/lib/admin/schemas';
import {
  parseFormatTokens, setDocumentNumberingStatus, testGenerateNumber,
  resetRunningNumber,
} from '@/lib/admin/document-numbering-service';

interface DocumentNumberingDetailViewProps {
  format: DocumentNumbering;
  onRefresh: () => void;
}

export function DocumentNumberingDetailView({ format, onRefresh }: DocumentNumberingDetailViewProps) {
  const { user, profile } = useAuth();
  const { role } = useAdminPermissions();
  const canEdit = canEditDocumentNumbering(role);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const auditMeta = {
    userId: user?.uid || 'system',
    userName: profile?.full_name || profile?.email || 'Admin',
  };

  const tokens = parseFormatTokens(format.formatTokens || '');

  const toggleStatus = async () => {
    setLoading(true);
    const activate = format.status !== 'Active';
    const result = await setDocumentNumberingStatus(
      format.id!,
      format,
      activate ? 'Active' : 'Inactive',
      auditMeta,
    );
    setLoading(false);
    if (result.success) {
      toast.success(activate ? 'Format activated' : 'Format deactivated');
      onRefresh();
    } else toast.error(result.error || 'Action failed');
    setConfirmDeactivate(false);
  };

  const runTest = async () => {
    setLoading(true);
    const result = await testGenerateNumber(format, auditMeta);
    setLoading(false);
    if (result.number) {
      setTestResult(result.number);
      toast.success('Test number generated');
    } else toast.error(result.error || 'Test failed');
  };

  const runReset = async () => {
    setLoading(true);
    const result = await resetRunningNumber(format.id!, format, auditMeta, 0);
    setLoading(false);
    if (result.success) {
      toast.success('Running number reset to 0');
      onRefresh();
    } else toast.error(result.error || 'Reset failed');
    setConfirmReset(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={format.numberingCode}
        description={`${format.moduleName} · ${format.documentType}`}
        basePath="/admin"
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={runTest} disabled={loading}>
                <Play className="h-4 w-4 mr-1" /> Test Generate
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)} disabled={loading}>
                <RotateCcw className="h-4 w-4 mr-1" /> Reset Sequence
              </Button>
              {format.status === 'Active' ? (
                <Button variant="outline" size="sm" onClick={() => setConfirmDeactivate(true)} disabled={loading}>
                  <UserX className="h-4 w-4 mr-1" /> Deactivate
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={toggleStatus} disabled={loading}>
                  <UserCheck className="h-4 w-4 mr-1" /> Activate
                </Button>
              )}
              <Button size="sm" asChild>
                <Link href={`/admin/document-numbering/${format.id}/edit`}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={format.status} />
        <ModuleBadge module={format.moduleName} />
        <ResetFrequencyBadge value={format.resetFrequency} />
        {format.autoGenerateEnabled && (
          <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Auto Generate</span>
        )}
        {format.manualOverrideAllowed && (
          <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-800">Manual Override</span>
        )}
      </div>

      {testResult && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-800">Test result: <span className="font-mono font-semibold">{testResult}</span></p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Numbering ID</span>
              <span className="font-mono">{format.numberingId}</span>
              <span className="text-muted-foreground">Prefix</span>
              <span>{format.prefix}</span>
              <span className="text-muted-foreground">Site Code</span>
              <span>{format.siteCode || '—'}</span>
              <span className="text-muted-foreground">Department Code</span>
              <span>{format.departmentCode || '—'}</span>
              <span className="text-muted-foreground">Product Code</span>
              <span>{format.productCodeOptional || '—'}</span>
              <span className="text-muted-foreground">Year / Month</span>
              <span>{format.yearFormat} / {format.monthFormat}</span>
              <span className="text-muted-foreground">Separator</span>
              <span>{format.separator}</span>
              <span className="text-muted-foreground">Running Length</span>
              <span>{format.runningNumberLength}</span>
              <span className="text-muted-foreground">Current Number</span>
              <span>{format.currentRunningNumber}</span>
              <span className="text-muted-foreground">Revision Format</span>
              <span>{format.revisionFormat}</span>
              <span className="text-muted-foreground">Example Preview</span>
              <span className="font-mono break-all">{format.exampleNumberPreview}</span>
            </div>
            {format.remarks && (
              <div>
                <p className="text-muted-foreground mb-1">Remarks</p>
                <p>{format.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <FormatBuilder
          tokens={tokens}
          onChange={() => {}}
          formValues={{
            numberingCode: format.numberingCode,
            moduleName: format.moduleName as DocumentNumberingFormData['moduleName'],
            documentType: format.documentType,
            prefix: format.prefix,
            siteCode: format.siteCode,
            departmentCode: format.departmentCode,
            productCodeOptional: format.productCodeOptional,
            yearFormat: format.yearFormat,
            monthFormat: format.monthFormat,
            separator: format.separator,
            runningNumberLength: format.runningNumberLength,
            currentRunningNumber: format.currentRunningNumber,
            resetFrequency: format.resetFrequency,
            revisionFormat: format.revisionFormat,
            formatTokens: format.formatTokens,
            autoGenerateEnabled: format.autoGenerateEnabled,
            manualOverrideAllowed: format.manualOverrideAllowed,
            remarks: format.remarks,
          }}
          readOnly
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><span className="text-muted-foreground">Created</span><p>{format.createdAt || '—'}</p></div>
          <div><span className="text-muted-foreground">Updated</span><p>{format.updatedAt || '—'}</p></div>
          <div><span className="text-muted-foreground">Created By</span><p>{format.createdBy || '—'}</p></div>
          <div><span className="text-muted-foreground">Updated By</span><p>{format.updatedBy || '—'}</p></div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate numbering format?</AlertDialogTitle>
            <AlertDialogDescription>
              New records will not use this format until reactivated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={toggleStatus}>Deactivate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset running number?</AlertDialogTitle>
            <AlertDialogDescription>
              This resets the current sequence to 0 for the current period. This action is audited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runReset}>Reset to 0</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
