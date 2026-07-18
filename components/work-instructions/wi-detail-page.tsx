'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { WiStatusBadge, WorkflowTimeline, VersionTimeline, ApprovalTimeline, EquipmentLinkCard, DocumentPreview } from '@/components/work-instructions/wi-ui';
import { getWiById, submitWiForReview, makeWiEffective } from '@/lib/wi-service';
import { getApprovals } from '@/lib/dms-service';
import type { WorkInstructionRecord } from '@/lib/wi-types';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import { toast } from 'sonner';

export function WiDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user, profile } = useAuth();
  const [wi, setWi] = useState<WorkInstructionRecord | null>(null);
  const [approvals, setApprovals] = useState<Array<{ stage: string; reviewer: string; decision: string; date: string }>>([]);
  const [loading, setLoading] = useState(true);
  const actor = { id: user?.uid || 'anonymous', name: profile?.full_name || 'Unknown', role: normalizeRole(profile?.role) };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const record = await getWiById(id);
      setWi(record);
      if (record?.document_id) {
        const ap = await getApprovals(record.document_id);
        setApprovals(ap.map((a) => ({ stage: a.stage, reviewer: a.reviewer_name, decision: a.decision, date: a.created_at })));
      }
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <LoadingSkeleton rows={6} />;
  if (!wi) return <p className="text-muted-foreground">Work instruction not found.</p>;

  return (
    <div className="space-y-6">
      <DmsPageHeader title={wi.wi_title} description={`${wi.wi_number} · v${wi.version}`}
        trail={[{ label: 'Work Instructions', href: '/qms/documents/work-instructions' }, { label: wi.wi_number }]}
        actions={
          <>
            <Button variant="outline" size="sm" asChild><Link href="/qms/documents/work-instructions"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
            {wi.document_id && <Button variant="outline" size="sm" asChild><Link href={`/qms/dms/${wi.document_id}`}>Open in DMS</Link></Button>}
            {wi.status === 'Draft' && <Button size="sm" onClick={async () => { try { await submitWiForReview(id, actor); toast.success('Submitted'); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } }}>Submit for Review</Button>}
            {wi.status === 'Approved' && <Button size="sm" onClick={async () => { try { await makeWiEffective(id, actor); toast.success('Effective'); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); } }}>Make Effective</Button>}
            <Button variant="outline" size="sm" onClick={() => load()}><RefreshCw className="h-4 w-4" /></Button>
          </>
        }
      />
      <WiStatusBadge status={wi.status} />
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="links">Equipment & SOP</TabsTrigger>
          <TabsTrigger value="preview">Document</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card><CardContent className="pt-6 text-sm space-y-2">
            <p>Owner: {wi.owner_name} · Department: {wi.department}</p>
            <p>Effective: {wi.effective_date || '—'} · Review Due: {wi.review_due_date || '—'}</p>
            <p>Training: {wi.training_required ? 'Required' : 'Not required'}</p>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="workflow"><Card><CardContent className="pt-6"><WorkflowTimeline currentStatus={wi.status} /></CardContent></Card></TabsContent>
        <TabsContent value="versions"><Card><CardContent className="pt-6"><VersionTimeline versions={[{ version: wi.version, status: wi.status, date: wi.updated_at }]} /></CardContent></Card></TabsContent>
        <TabsContent value="approvals"><Card><CardContent className="pt-6"><ApprovalTimeline entries={approvals} /></CardContent></Card></TabsContent>
        <TabsContent value="links"><EquipmentLinkCard equipment={wi.equipment} productionLine={wi.production_line} relatedSop={wi.related_sop} /></TabsContent>
        <TabsContent value="preview"><DocumentPreview title={wi.wi_title} /></TabsContent>
      </Tabs>
    </div>
  );
}
