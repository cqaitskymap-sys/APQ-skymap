'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { PenLine, Send, Archive, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PqrSectionPage } from '@/components/pqr/pqr-section-page';
import { ESignatureDialog } from '@/components/pqr/e-signature-dialog';
import { updatePqrStatus } from '@/lib/pqr-service';
import { useAuth } from '@/contexts/auth-context';
import type { PqrApproval } from '@/lib/pqr-types';

export default function PqrApprovalPage() {
  const pqrId = useParams().id as string;
  const { user, profile } = useAuth();
  const [signTarget, setSignTarget] = useState<PqrApproval | null>(null);
  const reloadRef = useRef<(() => void) | null>(null);

  return (
    <>
      <PqrSectionPage pqrId={pqrId} title="Approval Workflow" description="Multi-level review with electronic signatures (21 CFR Part 11)" showRefresh={false}>
        {({ document, approvals, reload }) => {
          reloadRef.current = reload;
          return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {document?.document_status === 'draft' && (
                <Button size="sm" className="gap-1 bg-blue-600" onClick={async () => {
                  await updatePqrStatus(pqrId, 'under_review', { id: user?.uid, name: profile?.full_name, role: profile?.role });
                  toast.success('Submitted for review'); reload();
                }}><Send className="h-3.5 w-3.5" />Submit for Review</Button>
              )}
              {document?.document_status === 'approved' && (
                <Button size="sm" variant="outline" className="gap-1" onClick={async () => {
                  await updatePqrStatus(pqrId, 'archived', { id: user?.uid, name: profile?.full_name, role: profile?.role });
                  toast.success('PQR archived'); reload();
                }}><Archive className="h-3.5 w-3.5" />Archive</Button>
              )}
              {['draft', 'under_review'].includes(document?.document_status || '') && (
                <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={async () => {
                  await updatePqrStatus(pqrId, 'rejected', { id: user?.uid, name: profile?.full_name, role: profile?.role });
                  toast.success('PQR rejected'); reload();
                }}><XCircle className="h-3.5 w-3.5" />Reject</Button>
              )}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Approval Matrix</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead className="bg-slate-50"><tr>
                      <th className="p-2 text-left border">Type</th>
                      <th className="p-2 text-left border">Designation</th>
                      <th className="p-2 text-left border">Name</th>
                      <th className="p-2 text-left border">Status</th>
                      <th className="p-2 text-left border">Date</th>
                      <th className="p-2 text-left border">Action</th>
                    </tr></thead>
                    <tbody>
                      {approvals.map((a) => (
                        <tr key={a.id}>
                          <td className="p-2 border capitalize">{a.approval_type}</td>
                          <td className="p-2 border">{a.designation}</td>
                          <td className="p-2 border">{a.name || '—'}</td>
                          <td className="p-2 border">
                            <Badge variant="outline" className={a.status === 'approved' ? 'text-green-700' : a.status === 'rejected' ? 'text-red-700' : ''}>{a.status}</Badge>
                          </td>
                          <td className="p-2 border">{a.approval_date || '—'}</td>
                          <td className="p-2 border">
                            {a.status === 'pending' && document?.document_status !== 'approved' && (
                              <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => setSignTarget(a)}>
                                <PenLine className="h-3 w-3" />E-Sign
                              </Button>
                            )}
                            {a.esign_meaning && <span className="text-xs text-muted-foreground">{a.esign_meaning}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
          );
        }}
      </PqrSectionPage>

      {signTarget && (
        <ESignatureDialog
          open={!!signTarget}
          onOpenChange={(o) => !o && setSignTarget(null)}
          pqrId={pqrId}
          approval={signTarget}
          onSigned={() => { setSignTarget(null); reloadRef.current?.(); }}
        />
      )}
    </>
  );
}
