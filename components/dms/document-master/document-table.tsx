'use client';

import Link from 'next/link';
import { Eye, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge, VersionBadge, CategoryBadge } from './status-badge';
import type { DocumentMasterTableRow } from '@/lib/document-master-types';

interface DocumentTableProps {
  rows: DocumentMasterTableRow[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  showFavorite?: boolean;
  favoriteIds?: Set<string>;
  emptyMessage?: string;
}

export function DocumentTable({
  rows,
  selectable,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  showFavorite,
  favoriteIds,
  emptyMessage = 'No documents found',
}: DocumentTableProps) {
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => onToggleSelectAll?.(rows.map((r) => r.id))}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            {showFavorite && <TableHead className="w-8" />}
            <TableHead>Document Number</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Effective</TableHead>
            <TableHead>Review Due</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={selectable ? 12 : 10} className="text-center py-8 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : rows.map((row) => (
            <TableRow key={row.id}>
              {selectable && (
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(row.id)}
                    onCheckedChange={() => onToggleSelect?.(row.id)}
                    aria-label={`Select ${row.document_number}`}
                  />
                </TableCell>
              )}
              {showFavorite && (
                <TableCell>
                  {favoriteIds?.has(row.id) && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                </TableCell>
              )}
              <TableCell className="font-mono text-sm whitespace-nowrap">{row.document_number}</TableCell>
              <TableCell className="max-w-[200px] truncate">{row.document_title}</TableCell>
              <TableCell><CategoryBadge category={row.document_category} /></TableCell>
              <TableCell>{row.department}</TableCell>
              <TableCell className="max-w-[120px] truncate">{row.owner_name}</TableCell>
              <TableCell><VersionBadge version={row.version} /></TableCell>
              <TableCell><StatusBadge status={row.document_status} /></TableCell>
              <TableCell className="text-sm whitespace-nowrap">{row.effective_date || '—'}</TableCell>
              <TableCell className="text-sm whitespace-nowrap">{row.review_due_date || '—'}</TableCell>
              <TableCell>
                <Link href={`/qms/dms/${row.id}`}>
                  <Button variant="ghost" size="sm" aria-label="View document">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
