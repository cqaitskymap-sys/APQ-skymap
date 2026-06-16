'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface FormSectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSectionCard({ title, description, children, className }: FormSectionCardProps) {
  return (
    <Card className={cn('border-slate-200 shadow-sm', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
