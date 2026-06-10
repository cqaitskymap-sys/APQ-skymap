import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const statusStyles: Record<string, string> = {
  Active: 'bg-green-50 text-green-700 border-green-200',
  Inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  Locked: 'bg-red-50 text-red-700 border-red-200',
  'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200',
  Open: 'bg-blue-50 text-blue-700 border-blue-200',
  Closed: 'bg-slate-100 text-slate-600 border-slate-200',
};

interface StatusBadgeProps {
  status?: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(statusStyles[status || ''] || 'bg-slate-100', className)}>
      {status || 'Unknown'}
    </Badge>
  );
}
