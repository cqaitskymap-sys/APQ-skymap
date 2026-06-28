'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import {
  SopStatusBadge, WorkflowTimeline, VersionTimeline, ApprovalTimeline,
  TrainingStatusCard, DocumentPreview, AuditTimeline,
} from '@/components/sop/sop-ui';
import { getSopById, submitSopForReview, makeSopEffective } from '@/lib/sop-service';
import { getApprovals } from '@/lib/dms-service';
import type { SopMasterRecord } from '@/lib/sop-types';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { toast } from 'sonner';

export function SopDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user, profile } = useAuth();
  const [sop, setSop] = useState<SopMasterRecord | null>(null);
  const [approvals, setApprovals] = useState<Array<{ stage: string; reviewer: string; decision: string; date: string }>>([]);
  const [loading, setLoading] = useState(true);

  const actor = {
    id: user?.uid || 'anonymous',
    name: profile?.full_name || 'Unknown',
    role: normalizeRole(profile?.role),
  };

  const load = async () => {
    setLoading(true);
    try {
      const record = await getSopById(id);
      setSop(record);
      if (record?.document_id) {
        const ap = await getApprovals(record.document_id);
        setApprovals(ap.map((a) => ({
          stage: a.stage, reviewer: a.reviewer_name, decision: a.decision, date: a.created_at,
        })));
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [id]);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (!sop) return <p className="text-muted-foreground">SOP not found.</p>;

  return (
    <div className="space-y-6">
      <DmsPageHeader
        title={sop.sop_title}
        description={`${sop.sop_number} · v${sop.version} · ${sop.department}`}
        trail={[{ label: 'SOP Management', href: '/qms/documents/sop' }, { label: sop.sop_number }]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild><Link href="/qms/documents/sop"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
            {sop.document_id && (
              <Button variant="outline" size="sm" asChild><Link href={`/qms/dms/${sop.document_id}`}>Open in DMS</Link></Button>
            )}
            {sop.status === 'Draft' && (
              <Button size="sm" onClick={async () => {
                try { await submitSopForReview(id, actor); toast.success('Submitted for review'); await load(); }
                catch (e) { toast.error(e instanceof Error ? e.message : 'Submit failed'); }
              }}>Submit for Review</Button>
            )}
            {sop.status === 'Approved' && (
              <Button size="sm" onClick={async () => {
                try { await makeSopEffective(id, actor); toast.success('SOP is now effective'); await load(); }
                catch (e) { toast.error(e instanceof Error ? e.message : 'Effective failed'); }
              }}>Make Effective</Button>
            )}
            <Button variant="outline" size="sm" onClick={() => load()}><RefreshCw className="h-4 w-4" /></Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <SopStatusBadge status={sop.status} />
        {sop.training_required && <span className="text-xs bg-orange-100 text-orange-800 rounded-full px-2 py-0.5">Training Required</span>}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="preview">Document</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-sm">SOP Metadata</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><span className="text-muted-foreground">Owner:</span> {sop.owner_name}</p>
                <p><span className="text-muted-foreground">Author:</span> {sop.author_name}</p>
                <p><span className="text-muted-foreground">Approver:</span> {sop.approver_name}</p>
                <p><span className="text-muted-foreground">Category:</span> {sop.category}</p>
                <p><span className="text-muted-foreground">Effective:</span> {sop.effective_date || '—'}</p>
                <p><span className="text-muted-foreground">Review Due:</span> {sop.review_due_date || '—'}</p>
                <p><span className="text-muted-foreground">Confidentiality:</span> {sop.confidentiality}</p>
              </CardContent>
            </Card>
            <TrainingStatusCard pct={sop.training_completion_pct} pending={sop.training_pending} required={sop.training_required} />
          </div>
        </TabsContent>

        <TabsContent value="workflow">
          <Card><CardContent className="pt-6"><WorkflowTimeline currentStatus={sop.status} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="versions">
          <Card><CardContent className="pt-6">
            <VersionTimeline versions={[{ version: sop.version, status: sop.status, date: sop.updated_at }]} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card><CardContent className="pt-6"><ApprovalTimeline entries={approvals} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="training">
          <TrainingStatusCard pct={sop.training_completion_pct} pending={sop.training_pending} required={sop.training_required} />
        </TabsContent>

        <TabsContent value="preview">
          <DocumentPreview title={sop.sop_title} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
