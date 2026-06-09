'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Search, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageLoader } from '@/components/loaders/page-loader';
import Link from 'next/link';

interface MaterialReview {
  id: string;
  batch_no: string;
  material_name: string;
  manufacturer_name: string;
  supplier_name: string;
  ar_no: string;
  lot_no: string;
  used_quantity: string;
  qc_status: string;
  avl_status: string;
  compliance_status: string;
}

interface PqrDoc {
  id: string;
  pqr_number: string;
  product_name: string;
}

const qcStatusColors: Record<string, string> = {
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  under_test: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  quarantine: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  retest_required: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const avlStatusColors: Record<string, string> = {
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  not_approved: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  conditional_approved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const complianceColors: Record<string, string> = {
  complies: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  does_not_comply: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  not_applicable: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export default function APIReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [pqr, setPqr] = useState<PqrDoc | null>(null);
  const [materials, setMaterials] = useState<MaterialReview[]>([]);
  const [filtered, setFiltered] = useState<MaterialReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState({
    materialName: '',
    batchNo: '',
    manufacturer: '',
    qcStatus: 'all',
    avlStatus: 'all',
    compliance: 'all',
  });

  useEffect(() => {
    const fetch = async () => {
      const id = params.id as string;

      // Fetch PQR
      const { data: pqrData } = await supabase
        .from('pqr_documents')
        .select('id, pqr_number, product_name')
        .eq('id', id)
        .maybeSingle();
      if (pqrData) setPqr(pqrData as PqrDoc);

      // Fetch material reviews for API only
      const { data: materialsData } = await supabase
        .from('material_review')
        .select('*')
        .eq('pqr_id', id)
        .eq('material_type', 'api')
        .order('created_at', { ascending: false });

      if (materialsData) {
        setMaterials(materialsData as MaterialReview[]);
        setFiltered(materialsData as MaterialReview[]);
      }

      setIsLoading(false);
    };
    fetch();
  }, [params.id]);

  // Apply filters
  useEffect(() => {
    let result = materials;

    if (filters.materialName) {
      result = result.filter((m) =>
        m.material_name.toLowerCase().includes(filters.materialName.toLowerCase())
      );
    }
    if (filters.batchNo) {
      result = result.filter((m) =>
        m.batch_no.toLowerCase().includes(filters.batchNo.toLowerCase())
      );
    }
    if (filters.manufacturer) {
      result = result.filter((m) =>
        m.manufacturer_name.toLowerCase().includes(filters.manufacturer.toLowerCase())
      );
    }
    if (filters.qcStatus !== 'all') {
      result = result.filter((m) => m.qc_status === filters.qcStatus);
    }
    if (filters.avlStatus !== 'all') {
      result = result.filter((m) => m.avl_status === filters.avlStatus);
    }
    if (filters.compliance !== 'all') {
      result = result.filter((m) => m.compliance_status === filters.compliance);
    }

    setFiltered(result);
  }, [filters, materials]);

  if (isLoading) return <PageLoader />;
  if (!pqr) return <div className="p-12 text-center"><p>PQR document not found</p></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/pqr/${pqr.id}/materials`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Materials Review</h1>
            <p className="text-sm text-muted-foreground">{pqr.pqr_number} • {pqr.product_name}</p>
          </div>
        </div>
        <Link href={`/dashboard/pqr/${pqr.id}/materials/create?material_type=api`}>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Review
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="material-name" className="text-sm">Material Name</Label>
              <Input
                id="material-name"
                placeholder="Search material..."
                value={filters.materialName}
                onChange={(e) => setFilters({ ...filters, materialName: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-no" className="text-sm">Batch No</Label>
              <Input
                id="batch-no"
                placeholder="Search batch..."
                value={filters.batchNo}
                onChange={(e) => setFilters({ ...filters, batchNo: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturer" className="text-sm">Manufacturer</Label>
              <Input
                id="manufacturer"
                placeholder="Search manufacturer..."
                value={filters.manufacturer}
                onChange={(e) => setFilters({ ...filters, manufacturer: e.target.value })}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qc-status" className="text-sm">QC Status</Label>
              <Select value={filters.qcStatus} onValueChange={(v) => setFilters({ ...filters, qcStatus: v })}>
                <SelectTrigger id="qc-status" className="text-sm">
                  <SelectValue placeholder="All QC Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="under_test">Under Test</SelectItem>
                  <SelectItem value="quarantine">Quarantine</SelectItem>
                  <SelectItem value="retest_required">Retest Required</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="avl-status" className="text-sm">AVL Status</Label>
              <Select value={filters.avlStatus} onValueChange={(v) => setFilters({ ...filters, avlStatus: v })}>
                <SelectTrigger id="avl-status" className="text-sm">
                  <SelectValue placeholder="All AVL Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="not_approved">Not Approved</SelectItem>
                  <SelectItem value="conditional_approved">Conditional</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="compliance" className="text-sm">Compliance</Label>
              <Select value={filters.compliance} onValueChange={(v) => setFilters({ ...filters, compliance: v })}>
                <SelectTrigger id="compliance" className="text-sm">
                  <SelectValue placeholder="All Compliance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="complies">Complies</SelectItem>
                  <SelectItem value="does_not_comply">Does Not Comply</SelectItem>
                  <SelectItem value="not_applicable">Not Applicable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Results <span className="text-muted-foreground font-normal">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Sr No</th>
                  <th className="px-4 py-2 text-left font-semibold">Batch No</th>
                  <th className="px-4 py-2 text-left font-semibold">Material Name</th>
                  <th className="px-4 py-2 text-left font-semibold">Manufacturer</th>
                  <th className="px-4 py-2 text-left font-semibold">Supplier</th>
                  <th className="px-4 py-2 text-left font-semibold">AR No</th>
                  <th className="px-4 py-2 text-left font-semibold">Lot No</th>
                  <th className="px-4 py-2 text-left font-semibold">Used Qty</th>
                  <th className="px-4 py-2 text-left font-semibold">QC Status</th>
                  <th className="px-4 py-2 text-left font-semibold">AVL Status</th>
                  <th className="px-4 py-2 text-left font-semibold">Compliance</th>
                  <th className="px-4 py-2 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                      No materials found
                    </td>
                  </tr>
                ) : (
                  filtered.map((material, idx) => (
                    <tr key={material.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-2 font-semibold">{idx + 1}</td>
                      <td className="px-4 py-2 font-mono text-xs">{material.batch_no}</td>
                      <td className="px-4 py-2">{material.material_name}</td>
                      <td className="px-4 py-2 text-xs">{material.manufacturer_name || '—'}</td>
                      <td className="px-4 py-2 text-xs">{material.supplier_name || '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{material.ar_no || '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{material.lot_no || '—'}</td>
                      <td className="px-4 py-2 text-xs">{material.used_quantity || '—'}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={qcStatusColors[material.qc_status] || ''}
                        >
                          {material.qc_status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={avlStatusColors[material.avl_status] || ''}
                        >
                          {material.avl_status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={complianceColors[material.compliance_status] || ''}
                        >
                          {material.compliance_status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Button variant="ghost" size="sm" className="gap-1">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
