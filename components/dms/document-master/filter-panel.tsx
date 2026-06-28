'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { DocumentMasterFilters } from '@/lib/document-master-types';
import { DOCUMENT_CATEGORIES, DOCUMENT_MASTER_STATUSES } from '@/lib/document-master-types';

interface FilterPanelProps {
  filters: DocumentMasterFilters;
  onChange: (filters: DocumentMasterFilters) => void;
  options: {
    categories: string[];
    departments: string[];
    owners: string[];
    statuses: string[];
    sites: string[];
    plants: string[];
    languages: string[];
  };
}

function FilterSelect({
  label, value, options, onChange, placeholder,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (v: string | undefined) => void;
  placeholder: string;
}) {
  return (
    <Select value={value ?? '__all__'} onValueChange={(v) => onChange(v === '__all__' ? undefined : v)}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All {label}</SelectItem>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search documents by number, title, owner, tags…',
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function FilterPanel({ filters, onChange, options }: FilterPanelProps) {
  const set = (patch: Partial<DocumentMasterFilters>) => onChange({ ...filters, ...patch });
  const hasFilters = Object.values(filters).some(Boolean);

  const categoryOptions = options.categories.length > 0 ? options.categories : [...DOCUMENT_CATEGORIES];
  const statusOptions = options.statuses.length > 0 ? options.statuses : [...DOCUMENT_MASTER_STATUSES];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <SearchBar value={filters.search} onChange={(search) => set({ search: search || undefined })} />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => onChange({})} className="gap-1 shrink-0">
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        <FilterSelect label="Categories" value={filters.category} options={categoryOptions} onChange={(category) => set({ category })} placeholder="Category" />
        <FilterSelect label="Departments" value={filters.department} options={options.departments} onChange={(department) => set({ department })} placeholder="Department" />
        <FilterSelect label="Owners" value={filters.owner} options={options.owners} onChange={(owner) => set({ owner })} placeholder="Owner" />
        <FilterSelect label="Statuses" value={filters.status} options={statusOptions} onChange={(status) => set({ status })} placeholder="Status" />
        <FilterSelect label="Sites" value={filters.site} options={options.sites} onChange={(site) => set({ site })} placeholder="Site" />
        <FilterSelect label="Plants" value={filters.plant} options={options.plants} onChange={(plant) => set({ plant })} placeholder="Plant" />
        <FilterSelect label="Languages" value={filters.language} options={options.languages.length ? options.languages : ['English']} onChange={(language) => set({ language })} placeholder="Language" />
        <Input type="date" className="h-9" value={filters.date_from ?? ''} onChange={(e) => set({ date_from: e.target.value || undefined })} placeholder="From" />
        <Input type="date" className="h-9" value={filters.date_to ?? ''} onChange={(e) => set({ date_to: e.target.value || undefined })} placeholder="To" />
      </div>
    </div>
  );
}
