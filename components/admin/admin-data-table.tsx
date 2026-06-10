'use client';

import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface AdminDataTableProps<T extends { id?: string }> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  searchKeys?: (keyof T)[];
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
}

export function AdminDataTable<T extends { id?: string; status?: string }>({
  columns,
  data,
  loading,
  searchKeys = [],
  onRowClick,
  actions,
  emptyMessage = 'No records found',
}: AdminDataTableProps<T>) {
  const [search, setSearch] = useState('');

  const filtered = data.filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return searchKeys.some((key) =>
      String(row[key] ?? '').toLowerCase().includes(q)
    ) || Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q));
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>{col.header}</TableHead>
              ))}
              {actions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-12 text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className={onRowClick ? 'cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-800/50' : ''}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render
                        ? col.render(row)
                        : col.key === 'status'
                          ? (
                            <Badge variant="outline" className={
                              row.status === 'Active'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-slate-100 text-slate-600'
                            }>
                              {String((row as Record<string, unknown>)[col.key] ?? '-')}
                            </Badge>
                          )
                          : String((row as Record<string, unknown>)[col.key] ?? '-')}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} of {data.length} records</p>
    </div>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    Active: 'bg-green-50 text-green-700 border-green-200',
    Inactive: 'bg-slate-100 text-slate-600 border-slate-200',
    Locked: 'bg-red-50 text-red-700 border-red-200',
    'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <Badge variant="outline" className={colors[status || ''] || 'bg-slate-100'}>
      {status || 'Unknown'}
    </Badge>
  );
}
