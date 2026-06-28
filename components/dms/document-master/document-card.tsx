'use client';

import Link from 'next/link';
import { Eye, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, VersionBadge, CategoryBadge } from './status-badge';
import type { DocumentMasterRecord } from '@/lib/document-master-types';

export function DocumentCard({ record }: { record: DocumentMasterRecord }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-muted-foreground">{record.document_number}</p>
            <CardTitle className="text-base truncate mt-0.5">{record.document_title}</CardTitle>
          </div>
          {record.is_favorite && <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <CategoryBadge category={record.document_category} />
          <VersionBadge version={record.version} major={record.major_version} minor={record.minor_version} />
          <StatusBadge status={record.document_status} />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Department</span><span className="text-foreground truncate">{record.department}</span>
          <span>Owner</span><span className="text-foreground truncate">{record.owner_name}</span>
          <span>Effective</span><span className="text-foreground">{record.effective_date || '—'}</span>
          <span>Review Due</span><span className="text-foreground">{record.review_due_date || '—'}</span>
        </div>
        <Link href={`/qms/dms/${record.id}`}>
          <Button variant="outline" size="sm" className="w-full gap-2">
            <Eye className="h-3.5 w-3.5" /> View Document
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
