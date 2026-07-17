'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Plus, RefreshCw, CheckCircle, XCircle, AlertTriangle, Award, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { useTrainingCertificates } from '@/hooks/use-training-certificates';
import type { CertificateFilters, TrainingCertificateRecord } from '@/lib/training-certificate-types';
import {
  createCertificate, approveCertificate, rejectCertificate, renewCertificate,
  revokeCertificate, bulkIssueCertificates, bulkRenewCertificates,
  exportCertificatesCsv, openCertificatePrint, logCertificateDownload,
  autoIssueFromTrainingRecord,
} from '@/lib/training-certificate-service';
import { listTrainingRecords } from '@/lib/training-service';
import { CertificateStatusBadge } from './certificate-status-badge';
import { CertificatePreview } from './certificate-preview';
import { CertificateFilterPanel } from './certificate-filter-panel';
import { CertificateDashboardCharts } from './certificate-dashboard-charts';
import { VerificationPanel } from './verification-panel';
import { ExportMenu } from './export-menu';
import { ExpiryIndicator } from './expiry-indicator';

const KPI_CONFIG = [
  { label: 'Total Certificates', key: 'totalCertificates' as const, tone: 'blue' as const },
  { label: 'Active', key: 'activeCertificates' as const, tone: 'green' as const },
  { label: 'Expiring Soon', key: 'expiringSoon' as const, tone: 'amber' as const },
  { label: 'Expired', key: 'expired' as const, tone: 'red' as const },
  { label: 'Renewed', key: 'renewed' as const, tone: 'teal' as const },
  { label: 'Revoked', key: 'revoked' as const, tone: 'red' as const },
  { label: 'Pending Approval', key: 'pendingApproval' as const, tone: 'amber' as const },
  { label: 'Issued This Month', key: 'issuedThisMonth' as const, tone: 'blue' as const },
  { label: 'Renewals Due', key: 'renewalsDue' as const, tone: 'amber' as const },
  { label: 'Compliance %', key: 'compliancePercent' as const, tone: 'green' as const, suffix: '%' },
];

interface TrainingCertificatePageProps {
  defaultTab?: 'dashboard' | 'registry' | 'verify';
}

export function TrainingCertificatePage({ defaultTab = 'dashboard' }: TrainingCertificatePageProps) {
  const [filters, setFilters] = useState<CertificateFilters>({});
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [page, setPage] = useState(1);
  const [selectedCert, setSelectedCert] = useState<TrainingCertificateRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [renewDate, setRenewDate] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [newCert, setNewCert] = useState({
    employee_id: '', employee_name: '', department: 'QA', designation: '',
    training_record_id: '', training_topic: '', issue_date: new Date().toISOString().slice(0, 10),
    expiry_date: '', training_type: 'GMP Training',
  });

  const {
    data, loading, refreshing, error, refresh, actor,
    canView, canManage, canApprove, isReadOnly, isEmployeeView,
    selectedIds, setSelectedIds,
  } = useTrainingCertificates(filters);

  const employees = useMemo(() => {
    const map = new Map<string, string>();
    data?.certificates.forEach((c) => map.set(c.employee_id, c.employee_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data?.certificates]);

  const trainers = useMemo(() => {
    const set = new Set<string>();
    data?.certificates.forEach((c) => { if (c.trainer) set.add(c.trainer); });
    return Array.from(set);
  }, [data?.certificates]);

  const paginated = useMemo(() => {
    if (!data) return [];
    const size = 15;
    const start = (page - 1) * size;
    return data.certificates.slice(start, start + size);
  }, [data, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.certificates.length / 15)) : 1;

  const columns: ColumnDef<TrainingCertificateRecord>[] = [
    ...(canApprove && !isReadOnly ? [{
      key: 'select', header: '',
      render: (r: TrainingCertificateRecord) => (
        <Checkbox checked={selectedIds.includes(r.id)} onCheckedChange={(c) =>
          setSelectedIds(c ? [...selectedIds, r.id] : selectedIds.filter((id) => id !== r.id))} />
      ),
    }] : []),
    { key: 'number', header: 'Certificate #', render: (r) => <span className="font-mono text-xs">{r.certificate_number}</span> },
    { key: 'employee', header: 'Employee', render: (r) => r.employee_name },
    { key: 'dept', header: 'Dept', render: (r) => r.department },
    { key: 'training', header: 'Training', render: (r) => <span className="text-xs">{r.training_topic}</span> },
    { key: 'status', header: 'Status', render: (r) => <CertificateStatusBadge status={r.certificate_status} /> },
    { key: 'approval', header: 'Approval', render: (r) => <CertificateStatusBadge status={r.approval_status} /> },
    { key: 'expiry', header: 'Expiry', render: (r) => <ExpiryIndicator expiryDate={r.expiry_date} /> },
  ];

  const handleApprove = useCallback(async (id: string) => {
    await approveCertificate(id, actor);
    toast.success('Certificate approved and issued');
    refresh();
  }, [actor, refresh]);

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view training certificates.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Certificate Management"
        description="Manage GMP training certificates, renewals and compliance."
        trail={[{ label: 'Certificate Management' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <ExportMenu
              canExport={canApprove && !isReadOnly}
              onCsv={() => { if (data) exportCertificatesCsv(data.certificates); toast.success('CSV exported'); }}
              onExcel={() => { if (data) exportCertificatesCsv(data.certificates); toast.success('Excel export downloaded'); }}
              onPrint={() => { if (selectedCert) openCertificatePrint(selectedCert); else toast.info('Select a certificate to print'); }}
            />
            {canManage && !isReadOnly && (
              <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Generate</Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-xs">21 CFR Part 11</Badge>
        <Badge variant="outline" className="text-xs">QR Verification</Badge>
        <Badge variant="outline" className="text-xs gap-1"><Award className="h-3 w-3" /> GMP Compliant</Badge>
      </div>

      {isReadOnly && <Alert><AlertTitle>Read-Only</AlertTitle><AlertDescription>Auditor view.</AlertDescription></Alert>}
      {isEmployeeView && <Alert><AlertDescription>Showing your certificates only.</AlertDescription></Alert>}
      {error && <ErrorCard message={error} onRetry={refresh} />}

      <CertificateFilterPanel filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} employees={employees} trainers={trainers} />

      {loading ? <LoadingSkeleton rows={8} /> : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {KPI_CONFIG.map(({ label, key, tone, suffix }) => (
              <KpiCard key={key} label={label} value={`${data.kpis[key]}${suffix ?? ''}`} tone={tone === 'teal' ? 'blue' : tone} />
            ))}
          </div>

          {canApprove && selectedIds.length > 0 && !isReadOnly && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => bulkIssueCertificates(selectedIds, actor).then((c) => { toast.success(`${c} issued`); refresh(); })}>
                <CheckCircle className="h-4 w-4 mr-1" /> Bulk Issue ({selectedIds.length})
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const d = new Date(); d.setFullYear(d.getFullYear() + 1);
                bulkRenewCertificates(selectedIds, d.toISOString().slice(0, 10), actor).then((c) => { toast.success(`${c} renewed`); refresh(); });
              }}>Bulk Renew</Button>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="registry">Certificate Registry</TabsTrigger>
              <TabsTrigger value="verify">Verification</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-4 space-y-4">
              <CertificateDashboardCharts charts={data.charts} />
              <ResponsiveDataTable
                data={data.recent}
                columns={columns.filter((c) => c.key !== 'select')}
                emptyMessage="No recent certificates"
                mobileTitleKey="employee_name"
                mobileSubtitleKey="certificate_number"
                actions={canApprove && !isReadOnly ? (r) => (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedCert(r); setPreviewOpen(true); }}>Preview</Button>
                    {r.approval_status === 'Pending' && <Button size="sm" onClick={() => handleApprove(r.id)}>Approve</Button>}
                  </div>
                ) : (r) => (
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedCert(r); setPreviewOpen(true); }}>View</Button>
                )}
              />
            </TabsContent>

            <TabsContent value="registry" className="mt-4 space-y-4">
              <Tabs defaultValue="all">
                <TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="expiring">Expiring</TabsTrigger><TabsTrigger value="expired">Expired</TabsTrigger><TabsTrigger value="renewal">Renewal Queue</TabsTrigger><TabsTrigger value="pending">Pending</TabsTrigger></TabsList>
                <TabsContent value="all" className="mt-4">
                  <ResponsiveDataTable data={paginated} columns={columns} emptyMessage="No certificates" mobileTitleKey="employee_name" mobileSubtitleKey="certificate_number"
                    actions={(r) => (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedCert(r); setPreviewOpen(true); }}>Preview</Button>
                        {canManage && r.approval_status === 'Pending' && <Button size="sm" onClick={() => handleApprove(r.id)}>Approve</Button>}
                        {canManage && <Button size="sm" variant="outline" onClick={() => { setSelectedCert(r); setRenewOpen(true); }}>Renew</Button>}
                      </div>
                    )} />
                </TabsContent>
                <TabsContent value="expiring" className="mt-4">
                  <ResponsiveDataTable data={data.expiring} columns={columns.filter((c) => c.key !== 'select')} emptyMessage="No expiring certificates" mobileTitleKey="employee_name" mobileSubtitleKey="certificate_number" />
                </TabsContent>
                <TabsContent value="expired" className="mt-4">
                  <ResponsiveDataTable data={data.expired} columns={columns.filter((c) => c.key !== 'select')} emptyMessage="No expired certificates" mobileTitleKey="employee_name" mobileSubtitleKey="certificate_number" />
                </TabsContent>
                <TabsContent value="renewal" className="mt-4">
                  <ResponsiveDataTable data={data.renewalQueue} columns={columns.filter((c) => c.key !== 'select')} emptyMessage="No renewals due" mobileTitleKey="employee_name" mobileSubtitleKey="certificate_number" />
                </TabsContent>
                <TabsContent value="pending" className="mt-4">
                  <ResponsiveDataTable data={data.pendingApproval} columns={columns} emptyMessage="No pending approvals" mobileTitleKey="employee_name" mobileSubtitleKey="certificate_number"
                    actions={canApprove && !isReadOnly ? (r) => (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleApprove(r.id)}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => rejectCertificate(r.id, actor, 'Rejected').then(() => refresh())}>Reject</Button>
                      </div>
                    ) : undefined} />
                </TabsContent>
              </Tabs>
              {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="verify" className="mt-4 space-y-4">
              <VerificationPanel actor={actor} onVerified={refresh} />
              {data.verificationLog.length > 0 && (
                <ResponsiveDataTable
                  data={data.verificationLog}
                  columns={[
                    { key: 'cert', header: 'Certificate', render: (v) => v.certificate_number },
                    { key: 'code', header: 'Code', render: (v) => <span className="font-mono text-xs">{v.verification_code}</span> },
                    { key: 'result', header: 'Result', render: (v) => <CertificateStatusBadge status={v.result} /> },
                    { key: 'at', header: 'Verified', render: (v) => new Date(v.verified_at).toLocaleString() },
                    { key: 'by', header: 'By', render: (v) => v.verified_by },
                  ]}
                  emptyMessage="No verifications yet"
                  mobileTitleKey="certificate_number"
                  mobileSubtitleKey="result"
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Certificate Preview</DialogTitle></DialogHeader>
          {selectedCert && (
            <>
              <CertificatePreview cert={selectedCert} />
              <DialogFooter>
                <Button variant="outline" onClick={() => { openCertificatePrint(selectedCert); logCertificateDownload(selectedCert.id, actor); }}>Print / PDF</Button>
                {canManage && selectedCert.approval_status === 'Pending' && (
                  <Button onClick={() => handleApprove(selectedCert.id).then(() => setPreviewOpen(false))}>Approve & Issue</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Certificate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Employee Name</Label><Input value={newCert.employee_name} onChange={(e) => setNewCert((c) => ({ ...c, employee_name: e.target.value }))} /></div>
            <div><Label>Employee ID</Label><Input value={newCert.employee_id} onChange={(e) => setNewCert((c) => ({ ...c, employee_id: e.target.value }))} /></div>
            <div><Label>Training Record ID</Label><Input value={newCert.training_record_id} onChange={(e) => setNewCert((c) => ({ ...c, training_record_id: e.target.value }))} /></div>
            <div><Label>Training Topic</Label><Input value={newCert.training_topic} onChange={(e) => setNewCert((c) => ({ ...c, training_topic: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Issue Date</Label><Input type="date" value={newCert.issue_date} onChange={(e) => setNewCert((c) => ({ ...c, issue_date: e.target.value }))} /></div>
              <div><Label>Expiry Date</Label><Input type="date" value={newCert.expiry_date} onChange={(e) => setNewCert((c) => ({ ...c, expiry_date: e.target.value }))} /></div>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              const records = await listTrainingRecords();
              const rec = records.find((r) => r.id === newCert.training_record_id);
              if (rec) {
                setNewCert((c) => ({
                  ...c, employee_id: rec.employee_id, employee_name: rec.employee_name,
                  department: rec.department, designation: rec.designation, training_topic: rec.training_topic,
                }));
                toast.success('Loaded from training record');
              }
            }}>Load from Training Record</Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                const payload = {
                  ...newCert, result: 'Pass', competency_level: 'Competent', renewal_required: true, remarks: '',
                  trainer: '', document_number: '', document_version: '', sop_number: '',
                };
                await createCertificate(payload, actor, false);
                toast.success('Certificate created (pending approval)');
                setCreateOpen(false);
                refresh();
              } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
            }}>Create Draft</Button>
            {canApprove && (
              <Button onClick={async () => {
                try {
                  if (!newCert.training_record_id) throw new Error('Training Record ID is required');
                  const certificate = await autoIssueFromTrainingRecord(newCert.training_record_id, actor);
                  if (!certificate) throw new Error('A passed, QA-approved training record is required');
                  toast.success(
                    certificate.approval_status === 'Approved'
                      ? 'Certificate already exists'
                      : 'Certificate draft created for approval',
                  );
                  setCreateOpen(false);
                  refresh();
                } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); }
              }}>Create from Record</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renew Certificate</DialogTitle></DialogHeader>
          <div><Label>New Expiry Date</Label><Input type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!selectedCert || !renewDate) return;
              await renewCertificate({ certificate_id: selectedCert.id, new_expiry_date: renewDate, remarks: '' }, actor);
              toast.success('Certificate renewed');
              setRenewOpen(false);
              refresh();
            }}>Renew</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revoke Certificate</DialogTitle></DialogHeader>
          <div><Label>Reason</Label><Textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (!selectedCert) return;
              await revokeCertificate({ certificate_id: selectedCert.id, reason: revokeReason }, actor);
              toast.success('Certificate revoked');
              setRevokeOpen(false);
              refresh();
            }}>Revoke</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
