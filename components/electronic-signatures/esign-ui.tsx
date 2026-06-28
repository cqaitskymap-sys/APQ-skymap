'use client';

import { cn } from '@/lib/utils';
import { signatureStatusColor } from '@/lib/electronic-signatures-types';
import type { ElectronicSignatureRecord } from '@/lib/electronic-signatures-types';
import { Check, Clock, Shield, ShieldCheck, Users } from 'lucide-react';

export function SignatureStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', signatureStatusColor(status), className)}>
      {status}
    </span>
  );
}

export function SignatureBadge({ verified }: { verified?: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      <ShieldCheck className="h-3 w-3" /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      <Shield className="h-3 w-3" /> Signed
    </span>
  );
}

export function SignatureHistory({ records }: { records: ElectronicSignatureRecord[] }) {
  if (!records.length) return <p className="text-sm text-muted-foreground py-4 text-center">No signature history.</p>;
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {records.map((r) => (
        <div key={r.id} className="rounded-lg border bg-card p-3 space-y-1">
          <div className="flex justify-between gap-2">
            <p className="font-mono text-xs text-muted-foreground">{r.signature_number}</p>
            <SignatureStatusBadge status={r.status} />
          </div>
          <p className="text-sm font-medium">{r.signer_name} · {r.module}</p>
          <p className="text-xs text-muted-foreground">{r.reference_number} · {r.signature_meaning}</p>
          <p className="text-xs text-muted-foreground">{r.signed_at ? new Date(r.signed_at).toLocaleString() : ''}</p>
        </div>
      ))}
    </div>
  );
}

export function SignatureVerificationCard({ record, onVerify }: {
  record: ElectronicSignatureRecord;
  onVerify?: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-indigo-600" />
        <h3 className="font-semibold">Signature Verification</h3>
      </div>
      <div className="grid gap-2 text-sm">
        <p><span className="text-muted-foreground">Signature:</span> {record.signature_number}</p>
        <p><span className="text-muted-foreground">Signer:</span> {record.signer_name} ({record.signer_role})</p>
        <p><span className="text-muted-foreground">Meaning:</span> {record.signature_meaning}</p>
        <p><span className="text-muted-foreground">Hash:</span> <code className="text-xs">{record.hash_value?.slice(0, 24)}…</code></p>
        <p><span className="text-muted-foreground">Auth:</span> {record.authentication_result}</p>
      </div>
      {onVerify && (
        <button type="button" onClick={onVerify} className="text-xs px-3 py-1.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
          Verify Integrity
        </button>
      )}
    </div>
  );
}

export function DualSignaturePanel({ records }: { records: ElectronicSignatureRecord[] }) {
  if (!records.length) return <p className="text-sm text-muted-foreground">No dual signatures pending.</p>;
  return (
    <div className="space-y-3">
      {records.map((r) => (
        <div key={r.id} className="rounded-lg border border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-orange-700" />
            <span className="font-medium text-sm">Dual Signature Pending</span>
          </div>
          <p className="text-sm">{r.reference_number} · {r.module}</p>
          <p className="text-xs text-muted-foreground">Primary signer: {r.signer_name}</p>
        </div>
      ))}
    </div>
  );
}

export function SignatureTable({ records, selectedIds, toggleSelect, toggleSelectAll, isReadOnly, compact, onVerify }: {
  records: ElectronicSignatureRecord[];
  selectedIds?: string[];
  toggleSelect?: (id: string) => void;
  toggleSelectAll?: () => void;
  isReadOnly?: boolean;
  compact?: boolean;
  onVerify?: (id: string) => void;
}) {
  if (!records.length) return <p className="py-8 text-center text-sm text-muted-foreground">No signatures match filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {!isReadOnly && toggleSelect && <th className="p-3 w-10"><input type="checkbox" onChange={toggleSelectAll} className="rounded" /></th>}
            <th className="p-3 text-left font-medium">Signature #</th>
            <th className="p-3 text-left font-medium">Module</th>
            <th className="p-3 text-left font-medium hidden md:table-cell">Signer</th>
            <th className="p-3 text-left font-medium">Status</th>
            {!compact && <th className="p-3 text-left font-medium hidden lg:table-cell">Signed At</th>}
            {onVerify && <th className="p-3 text-left font-medium">Verify</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              {!isReadOnly && toggleSelect && (
                <td className="p-3"><input type="checkbox" checked={selectedIds?.includes(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
              )}
              <td className="p-3 font-mono text-xs">{r.signature_number}</td>
              <td className="p-3">
                <p className="truncate font-medium">{r.module}</p>
                <p className="text-xs text-muted-foreground">{r.reference_number}</p>
              </td>
              <td className="p-3 hidden md:table-cell">{r.signer_name}</td>
              <td className="p-3"><SignatureStatusBadge status={r.status} /></td>
              {!compact && <td className="p-3 hidden lg:table-cell text-muted-foreground">{r.signed_at ? new Date(r.signed_at).toLocaleString() : '—'}</td>}
              {onVerify && (
                <td className="p-3">
                  <button type="button" onClick={() => onVerify(r.id)} className="text-xs text-indigo-600 hover:underline">Verify</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditTimeline({ entries }: { entries: Array<{ action: string; user: string; date: string }> }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No audit entries.</p>;
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {entries.map((e, i) => (
        <div key={i} className="rounded border px-3 py-2 text-sm flex gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div><p className="font-medium">{e.action}</p><p className="text-xs text-muted-foreground">{e.user} · {new Date(e.date).toLocaleString()}</p></div>
        </div>
      ))}
    </div>
  );
}

export { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
