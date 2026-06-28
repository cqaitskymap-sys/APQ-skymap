'use client';

import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExportMenuProps {
  canExport: boolean;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
}

export function ExportMenu({ canExport, onExportCsv, onExportExcel, onPrint }: ExportMenuProps) {
  if (!canExport) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><FileSpreadsheet className="h-4 w-4 mr-1" /> Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportCsv}><FileText className="h-4 w-4 mr-2" />Export CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={onExportExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Export Excel</DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint}><Printer className="h-4 w-4 mr-2" />Print / PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
