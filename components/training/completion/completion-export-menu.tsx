'use client';

import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function CompletionExportMenu({ canExport, onAttendanceCsv, onRecordsCsv, onPrint }: {
  canExport: boolean;
  onAttendanceCsv: () => void;
  onRecordsCsv: () => void;
  onPrint: () => void;
}) {
  if (!canExport) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><FileSpreadsheet className="h-4 w-4 mr-1" /> Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onAttendanceCsv}><FileText className="h-4 w-4 mr-2" />Attendance CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={onRecordsCsv}><FileText className="h-4 w-4 mr-2" />Completion Records CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint}><Printer className="h-4 w-4 mr-2" />Print Report</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
