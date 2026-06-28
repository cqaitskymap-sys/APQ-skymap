'use client';

import { cn } from '@/lib/utils';

export function ExpiryIndicator({ expiryDate }: { expiryDate: string }) {
  if (!expiryDate) return <span className="text-muted-foreground">No expiry</span>;
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.ceil((new Date(expiryDate).getTime() - new Date(today).getTime()) / 86400000);

  if (days < 0) {
    return <span className="text-red-600 font-medium">Expired {Math.abs(days)} days ago</span>;
  }
  if (days <= 30) {
    return <span className="text-amber-600 font-medium">Expires in {days} days</span>;
  }
  return <span className="text-green-700">Valid until {expiryDate}</span>;
}

export function QRCodePlaceholder({ data, size = 80 }: { data: string; size?: number }) {
  return (
    <div
      className={cn('border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center font-mono text-[8px] text-center p-1 break-all')}
      style={{ width: size, height: size }}
      title={data}
    >
      QR
    </div>
  );
}
