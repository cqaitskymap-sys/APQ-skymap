'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import {
  CLEANROOM_GRADES, AREA_STATUSES, MONITORING_DEPARTMENTS,
  MONITORING_TYPES, UTILITY_TYPES, MONITORING_STATUSES,
} from '@/lib/monitoring-mgmt-types';
import type { AreaFilters, MonitoringFilters } from '@/lib/monitoring-mgmt-types';
import type { AreaRecord } from '@/lib/monitoring-mgmt-types';

export function AreaFiltersBar({ filters, onChange }: { filters: AreaFilters; onChange: (f: AreaFilters) => void }) {
  const update = (key: keyof AreaFilters, value: string) => onChange({ ...filters, [key]: value || undefined });
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input placeholder="Search code, name, room…" className="w-full sm:w-56" value={filters.search || ''} onChange={(e) => update('search', e.target.value)} />
      <Select value={filters.cleanroom_grade || 'all'} onValueChange={(v) => update('cleanroom_grade', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Grade" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Grades</SelectItem>{CLEANROOM_GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filters.department || 'all'} onValueChange={(v) => update('department', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Dept" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Depts</SelectItem>{MONITORING_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
      </Select>
      {(filters.search || filters.cleanroom_grade || filters.department) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}><X className="h-4 w-4 mr-1" />Clear</Button>
      )}
    </div>
  );
}

export function MonitoringFiltersBar({ filters, onChange }: { filters: MonitoringFilters; onChange: (f: MonitoringFilters) => void }) {
  const update = (key: keyof MonitoringFilters, value: string) => onChange({ ...filters, [key]: value || undefined });
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Input placeholder="Search…" className="w-full sm:w-48" value={filters.search || ''} onChange={(e) => update('search', e.target.value)} />
      <Select value={filters.status || 'all'} onValueChange={(v) => update('status', v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Status</SelectItem>{MONITORING_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
      </Select>
      {(filters.search || filters.status) && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}><X className="h-4 w-4 mr-1" />Clear</Button>
      )}
    </div>
  );
}

export function AreaPicker({ areas, value, onChange }: {
  areas: AreaRecord[]; value: string;
  onChange: (docId: string, name: string, room: string, grade: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => {
      const a = areas.find((x) => x.id === v);
      if (a) onChange(a.id, a.area_name, a.room_number, a.cleanroom_grade);
    }}>
      <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
      <SelectContent>{areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.area_code} — {a.area_name}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export const MONITORING_TYPE_UNITS: Record<string, string> = {
  Temperature: '°C', 'Relative Humidity': '%', 'Differential Pressure': 'Pa',
  'Non-Viable Particle': 'particles/m³', 'Viable Particle': 'CFU/m³',
  'Surface Monitoring': 'CFU/plate', 'Personnel Monitoring': 'CFU/glove',
  'Settle Plate': 'CFU/4hr', 'Active Air Sampling': 'CFU/m³',
};

export const UTILITY_PARAM_UNITS: Record<string, string> = {
  Conductivity: 'µS/cm', TOC: 'ppb', pH: 'pH', 'Microbial Count': 'CFU/mL',
  Endotoxin: 'EU/mL', Pressure: 'bar', Temperature: '°C', 'Dew Point': '°C',
  'Oil Content': 'mg/m³', 'Particle Count': 'particles/m³',
};
