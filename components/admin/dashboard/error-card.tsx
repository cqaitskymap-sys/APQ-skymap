'use client';

import { AlertTriangle, ShieldX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ErrorCardProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  accessDenied?: boolean;
}

export function ErrorCard({
  title = 'Something went wrong',
  message = 'Unable to load dashboard data. Please try again.',
  onRetry,
  accessDenied,
}: ErrorCardProps) {
  const Icon = accessDenied ? ShieldX : AlertTriangle;
  const color = accessDenied ? 'text-red-500' : 'text-amber-500';

  return (
    <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <Icon className={`h-12 w-12 ${color}`} />
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">{message}</p>
        </div>
        {onRetry && !accessDenied && (
          <Button variant="outline" onClick={onRetry}>Try Again</Button>
        )}
      </CardContent>
    </Card>
  );
}
