'use client';

import type { CpvReviewApprovalRecord } from '@/lib/cpv-annual-review-records';

export function ApprovalTimeline({ signatures }: { signatures: CpvReviewApprovalRecord[] }) {
  if (!signatures?.length) {
    return <p className="text-sm text-muted-foreground">No approval signatures recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-4">
      {signatures.map((sig, i) => (
        <li key={`${sig.role}-${i}`} className="relative">
          <span className={`absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full border-2 border-white ${sig.signedAt ? 'bg-blue-600' : 'bg-slate-300'}`} />
          <div className="rounded-md border bg-white p-3 text-sm shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold capitalize">{sig.role}</p>
              <span className={`text-xs ${sig.signedAt ? 'text-green-700' : 'text-amber-700'}`}>
                {sig.signedAt ? 'Signed' : 'Pending'}
              </span>
            </div>
            <p className="text-muted-foreground">{sig.designation}</p>
            <p className="mt-1">{sig.name || '—'}</p>
            {sig.signedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(sig.signedAt).toLocaleString()} · {sig.meaning || '—'}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
