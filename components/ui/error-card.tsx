'use client';

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorCardProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorCard({
  title = 'Something went wrong',
  message = 'An error occurred while loading data. Please try again.',
  onRetry,
  className,
}: ErrorCardProps) {
  return (
    <Card className={cn('border-red-200', className)}>
      <CardContent className="flex flex-col items-center text-center gap-3 py-8">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>Try Again</Button>
        )}
      </CardContent>
    </Card>
  );
}
