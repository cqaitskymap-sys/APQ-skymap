'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrainingReportType } from '@/lib/training-reports-records';

interface ReportCardProps {
  title: TrainingReportType | string;
  description: string;
  selected?: boolean;
  onClick?: () => void;
}

export function ReportCard({ title, description, selected, onClick }: ReportCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:border-blue-300',
        selected && 'border-blue-500 bg-blue-50/40',
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <CardTitle className="text-sm font-medium leading-tight">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
