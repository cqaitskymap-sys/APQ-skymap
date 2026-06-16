'use client';

export function PriorityBadge({ priority }: { priority: string }) {
  const cls = priority === 'Critical' ? 'bg-red-900/10 text-red-900 border-red-300'
    : priority === 'High' ? 'bg-red-50 text-red-700 border-red-200'
      : priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-green-50 text-green-700 border-green-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{priority}</span>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const cls = severity === 'Critical' ? 'bg-red-900/10 text-red-900 border-red-300'
    : severity === 'Major' ? 'bg-orange-50 text-orange-700 border-orange-200'
      : severity === 'Warning' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-blue-50 text-blue-700 border-blue-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{severity}</span>;
}

export function RiskBadge({ level }: { level: string }) {
  const cls = level === 'Critical' ? 'bg-red-900/10 text-red-900 border-red-300'
    : level === 'High' ? 'bg-red-50 text-red-700 border-red-200'
      : level === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-green-50 text-green-700 border-green-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{level}</span>;
}

export function AlertStatusBadge({ status }: { status: string }) {
  const cls = status === 'Closed' ? 'bg-green-50 text-green-700 border-green-200'
    : status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200'
      : status === 'Overdue' ? 'bg-red-50 text-red-700 border-red-200'
        : status === 'Acknowledged' ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-amber-50 text-amber-700 border-amber-200';
  return <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}
