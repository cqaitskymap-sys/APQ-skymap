'use client';

import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AssignmentExportMenu({ canExport, onCsv, onPrint }: {
  canExport: boolean;
  onCsv: () => void;
  onPrint: () => void;
}) {
  if (!canExport) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><FileSpreadsheet className="h-4 w-4 mr-1" /> Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCsv}><FileText className="h-4 w-4 mr-2" />CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint}><Printer className="h-4 w-4 mr-2" />Print Report</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
