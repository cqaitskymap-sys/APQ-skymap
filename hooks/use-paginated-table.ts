'use client';

import { useMemo, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

export type SortDirection = 'asc' | 'desc';

export interface PaginatedTableOptions<T> {
  data: T[];
  searchKeys?: Array<keyof T & string>;
  initialPageSize?: number;
  initialSortKey?: keyof T & string;
}

export function usePaginatedTable<T extends Record<string, unknown>>({
  data,
  searchKeys = [],
  initialPageSize = 15,
  initialSortKey,
}: PaginatedTableOptions<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<(keyof T & string) | undefined>(initialSortKey);
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const debouncedSearch = useDebouncedValue(search, 250);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let rows = data;
    if (q && searchKeys.length) {
      rows = data.filter((row) =>
        searchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(q)),
      );
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, debouncedSearch, searchKeys, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const toggleSort = (key: keyof T & string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  return {
    search,
    setSearch,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    sortKey,
    sortDir,
    toggleSort,
    filtered,
    pageRows,
    total: filtered.length,
    totalPages,
    from: filtered.length ? (safePage - 1) * pageSize + 1 : 0,
    to: Math.min(safePage * pageSize, filtered.length),
  };
}
