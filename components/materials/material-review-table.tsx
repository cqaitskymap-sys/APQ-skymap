'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  QC_STATUSES,
  AVL_STATUSES,
  COMPLIANCE_STATUSES,
  MATERIAL_TYPES,
} from '@/lib/material-schemas';
import {
  getQCStatusBadgeColor,
  getAVLStatusBadgeColor,
  getComplianceBadgeColor,
} from '@/lib/compliance-logic';
import { MoreHorizontal, Edit2, Trash2, Eye } from 'lucide-react';

export interface MaterialReviewRow {
  id: string;
  batchNo: string;
  materialName: string;
  materialType: string;
  manufacturerName: string;
  supplierName: string;
  arNo: string;
  lotNo: string;
  usedQuantity: number;
  unit: string;
  qcStatus: string;
  avlStatus: string;
  complianceStatus: string;
}

interface MaterialReviewTableProps {
  data: MaterialReviewRow[];
  isLoading?: boolean;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

interface Filters {
  materialType: string;
  materialName: string;
  batchNo: string;
  manufacturer: string;
  supplier: string;
  qcStatus: string;
  avlStatus: string;
  complianceStatus: string;
}

export function MaterialReviewTable({
  data,
  isLoading = false,
  onView,
  onEdit,
  onDelete,
}: MaterialReviewTableProps) {
  const [filters, setFilters] = useState<Filters>({
    materialType: '',
    materialName: '',
    batchNo: '',
    manufacturer: '',
    supplier: '',
    qcStatus: '',
    avlStatus: '',
    complianceStatus: '',
  });

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      if (filters.materialType && row.materialType !== filters.materialType) return false;
      if (filters.materialName && !row.materialName.toLowerCase().includes(filters.materialName.toLowerCase())) return false;
      if (filters.batchNo && !row.batchNo.toLowerCase().includes(filters.batchNo.toLowerCase())) return false;
      if (filters.manufacturer && !row.manufacturerName.toLowerCase().includes(filters.manufacturer.toLowerCase())) return false;
      if (filters.supplier && !row.supplierName.toLowerCase().includes(filters.supplier.toLowerCase())) return false;
      if (filters.qcStatus && row.qcStatus !== filters.qcStatus) return false;
      if (filters.avlStatus && row.avlStatus !== filters.avlStatus) return false;
      if (filters.complianceStatus && row.complianceStatus !== filters.complianceStatus) return false;
      return true;
    });
  }, [data, filters]);

  const resetFilters = () => {
    setFilters({
      materialType: '',
      materialName: '',
      batchNo: '',
      manufacturer: '',
      supplier: '',
      qcStatus: '',
      avlStatus: '',
      complianceStatus: '',
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Filters</h3>
          {Object.values(filters).some((v) => v) && (
            <Button variant="link" size="sm" onClick={resetFilters} className="h-auto p-0">
              Reset Filters
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium mb-1.5 block">Material Type</label>
            <Select value={filters.materialType} onValueChange={(value) => setFilters({ ...filters, materialType: value })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                {MATERIAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block">QC Status</label>
            <Select value={filters.qcStatus} onValueChange={(value) => setFilters({ ...filters, qcStatus: value })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                {QC_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block">AVL Status</label>
            <Select value={filters.avlStatus} onValueChange={(value) => setFilters({ ...filters, avlStatus: value })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All AVL" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All AVL</SelectItem>
                {AVL_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block">Compliance</label>
            <Select value={filters.complianceStatus} onValueChange={(value) => setFilters({ ...filters, complianceStatus: value })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Compliance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Compliance</SelectItem>
                {COMPLIANCE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block">Batch No</label>
            <Input
              placeholder="Search batch..."
              value={filters.batchNo}
              onChange={(e) => setFilters({ ...filters, batchNo: e.target.value })}
              className="h-8 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block">Material Name</label>
            <Input
              placeholder="Search material..."
              value={filters.materialName}
              onChange={(e) => setFilters({ ...filters, materialName: e.target.value })}
              className="h-8 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block">Manufacturer</label>
            <Input
              placeholder="Search manufacturer..."
              value={filters.manufacturer}
              onChange={(e) => setFilters({ ...filters, manufacturer: e.target.value })}
              className="h-8 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block">Supplier</label>
            <Input
              placeholder="Search supplier..."
              value={filters.supplier}
              onChange={(e) => setFilters({ ...filters, supplier: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-blue-50 dark:bg-blue-950/20 sticky top-0">
              <TableRow className="border-blue-200 dark:border-blue-900/30">
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 w-8">Sr.</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 min-w-24">Batch No</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 min-w-32">Material</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 min-w-20">Type</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 min-w-28">Manufacturer</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 min-w-28">Supplier</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 min-w-20">AR No</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 min-w-20">Lot No</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 min-w-20">Used Qty</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 min-w-20">QC Status</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 min-w-20">AVL Status</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 min-w-24">Compliance</TableHead>
                <TableHead className="text-xs font-semibold text-blue-900 dark:text-blue-100 w-16">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    Loading materials...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    No materials found
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((row, index) => (
                  <TableRow key={row.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/10">
                    <TableCell className="text-xs">{index + 1}</TableCell>
                    <TableCell className="text-xs font-mono">{row.batchNo}</TableCell>
                    <TableCell className="text-xs font-medium">{row.materialName}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-xs font-normal">
                        {row.materialType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{row.manufacturerName}</TableCell>
                    <TableCell className="text-xs">{row.supplierName}</TableCell>
                    <TableCell className="text-xs font-mono">{row.arNo}</TableCell>
                    <TableCell className="text-xs font-mono">{row.lotNo}</TableCell>
                    <TableCell className="text-xs text-right">
                      {row.usedQuantity} {row.unit}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge className={`text-xs font-normal ${getQCStatusBadgeColor(row.qcStatus)}`}>
                        {row.qcStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge className={`text-xs font-normal ${getAVLStatusBadgeColor(row.avlStatus)}`}>
                        {row.avlStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge className={`text-xs font-normal ${getComplianceBadgeColor(row.complianceStatus)}`}>
                        {row.complianceStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => onView?.(row.id)} className="text-xs">
                            <Eye className="h-3 w-3 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit?.(row.id)} className="text-xs">
                            <Edit2 className="h-3 w-3 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete?.(row.id)}
                            className="text-xs text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing <span className="font-semibold">{filteredData.length}</span> of <span className="font-semibold">{data.length}</span> records
        </span>
      </div>
    </div>
  );
}
