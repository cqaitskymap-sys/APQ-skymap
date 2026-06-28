'use client';

import { FileSpreadsheet, FileText, Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function HistoryExportMenu({ canExport, onCsv, onExcel, onPrint, onDownload }: {
  canExport: boolean;
  onCsv: () => void;
  onExcel: () => void;
  onPrint: () => void;
  onDownload?: () => void;
}) {
  if (!canExport) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><FileSpreadsheet className="h-4 w-4 mr-1" /> Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onDownload && <DropdownMenuItem onClick={onDownload}><Download className="h-4 w-4 mr-2" />Download Record</DropdownMenuItem>}
        <DropdownMenuItem onClick={onCsv}><FileText className="h-4 w-4 mr-2" />CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={onExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint}><Printer className="h-4 w-4 mr-2" />Print Inspection Report</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
