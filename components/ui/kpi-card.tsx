import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'slate';
  className?: string;
}

const toneClasses = {
  blue: 'border-l-blue-600',
  green: 'border-l-emerald-600',
  amber: 'border-l-amber-500',
  red: 'border-l-red-600',
  slate: 'border-l-slate-500',
};

export function KpiCard({ label, value, detail, tone = 'blue', className }: KpiCardProps) {
  return (
    <Card className={cn('border-l-4 shadow-sm', toneClasses[tone], className)}>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

export default KpiCard;
