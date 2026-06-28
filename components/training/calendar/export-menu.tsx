'use client';

import { Download, FileSpreadsheet, Printer, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportEventsCsv, exportEventsIcs } from '@/lib/training-calendar-service';
import type { TrainingEvent } from '@/lib/training-calendar-types';
import { printPage } from '@/lib/export-utils';

interface ExportMenuProps {
  events: TrainingEvent[];
}

export function ExportMenu({ events }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportEventsCsv(events)}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> CSV / Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportEventsIcs(events)}>
          <CalendarIcon className="h-4 w-4 mr-2" /> ICS Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={printPage}>
          <Printer className="h-4 w-4 mr-2" /> Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
