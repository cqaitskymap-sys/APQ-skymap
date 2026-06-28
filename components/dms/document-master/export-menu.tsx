'use client';

import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExportMenuProps {
  onExportCsv: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  disabled?: boolean;
}

export function ExportMenu({ onExportCsv, onExportExcel, onPrint, disabled }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportCsv} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" /> Export Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
