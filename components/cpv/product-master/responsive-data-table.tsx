'use client';

import { AdminDataTable, type ColumnDef } from '@/components/admin/admin-data-table';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/cpv/cpv-ui';

interface ResponsiveDataTableProps<T extends { id?: string }> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  searchKeys?: (keyof T)[];
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  pageSize?: number;
  statusKey?: string;
  statusOptions?: string[];
  mobileTitleKey?: string;
  mobileSubtitleKey?: string;
}

export function ResponsiveDataTable<T extends { id?: string }>({
  columns,
  data,
  loading,
  searchKeys,
  onRowClick,
  actions,
  emptyMessage,
  pageSize,
  statusKey,
  statusOptions,
  mobileTitleKey = 'productName',
  mobileSubtitleKey = 'productCode',
}: ResponsiveDataTableProps<T>) {
  return (
    <div className="space-y-4">
      <div className="hidden md:block">
        <AdminDataTable
          columns={columns}
          data={data}
          loading={loading}
          searchKeys={searchKeys}
          onRowClick={onRowClick}
          actions={actions}
          emptyMessage={emptyMessage}
          pageSize={pageSize}
          statusKey={statusKey}
          statusOptions={statusOptions}
        />
      </div>
      <div className="space-y-3 md:hidden">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : data.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">{emptyMessage || 'No records found'}</p>
        ) : (
          data.slice(0, pageSize || 10).map((row) => {
            const title = String((row as Record<string, unknown>)[mobileTitleKey] ?? '—');
            const subtitle = String((row as Record<string, unknown>)[mobileSubtitleKey] ?? '');
            const statusVal = String((row as Record<string, unknown>)[statusKey || 'cpvStatus'] ?? '');
            return (
              <Card
                key={row.id}
                className="cursor-pointer shadow-sm"
                onClick={() => onRowClick?.(row)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{title}</p>
                      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                    </div>
                    {statusVal && <StatusBadge status={statusVal} />}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {columns.slice(0, 4).map((col) => (
                      <div key={col.key}>
                        <span className="font-medium text-slate-600">{col.header}: </span>
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[col.key] ?? '—')}
                      </div>
                    ))}
                  </div>
                  {actions && (
                    <div className="pt-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
