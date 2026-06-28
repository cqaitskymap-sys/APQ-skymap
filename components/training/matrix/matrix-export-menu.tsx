'use client';

import { FileSpreadsheet, FileText, Printer, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function MatrixExportMenu({ canExport, onCsv, onComplianceCsv, onPrint, onImport }: {
  canExport: boolean;
  onCsv: () => void;
  onComplianceCsv: () => void;
  onPrint: () => void;
  onImport?: () => void;
}) {
  if (!canExport) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><FileSpreadsheet className="h-4 w-4 mr-1" /> Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCsv}><FileText className="h-4 w-4 mr-2" />Matrix CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={onComplianceCsv}><FileText className="h-4 w-4 mr-2" />Compliance CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint}><Printer className="h-4 w-4 mr-2" />Print Report</DropdownMenuItem>
        {onImport && (
          <DropdownMenuItem onClick={onImport} disabled><Upload className="h-4 w-4 mr-2" />Import Excel (placeholder)</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
