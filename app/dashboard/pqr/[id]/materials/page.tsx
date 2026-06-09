'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Download, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { PageLoader } from '@/components/loaders/page-loader';
import { ComplianceSummaryCards } from '@/components/materials/compliance-summary-cards';
import { MaterialReviewTable } from '@/components/materials/material-review-table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getMaterialReviewsByPQR, deleteMaterialReview, logMaterialAudit } from '@/lib/material-service';

interface MaterialReview {
  id: string;
  pqrId: string;
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
  expDate?: string;
}

export default function MaterialReviewListPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [materials, setMaterials] = useState<MaterialReview[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pqrId = params.id as string;

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const data = await getMaterialReviewsByPQR(pqrId);
        setMaterials((data || []).filter((material) => Boolean(material.id)) as MaterialReview[]);
      } catch (err: any) {
        toast({
          title: 'Error loading materials',
          description: err.message,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (pqrId) {
      fetchMaterials();
    }
  }, [pqrId, toast]);

  // Calculate summary statistics
  const stats = {
    totalMaterials: materials.length,
    totalAPILots: materials.filter((m) => m.materialType === 'API').length,
    totalRawMaterialLots: materials.filter((m) => m.materialType !== 'API').length,
    approvedLots: materials.filter((m) => m.qcStatus === 'Approved').length,
    rejectedLots: materials.filter((m) => m.qcStatus === 'Rejected').length,
    avlCompliantLots: materials.filter((m) => m.avlStatus === 'Approved').length,
    nonCompliantLots: materials.filter((m) => m.complianceStatus === 'Does Not Comply').length,
    expiredRetestDueMaterials: materials.filter((m) => {
      const expiryDate = m.expDate ? new Date(m.expDate) : null;
      return expiryDate && expiryDate < new Date();
    }).length,
  };

  const handleDelete = async () => {
    if (!deleteId || !user) return;

    setIsDeleting(true);
    try {
      await deleteMaterialReview(deleteId);

      // Log audit
      await logMaterialAudit(
        {
          module: 'MATERIAL_REVIEW',
          recordId: deleteId,
          fieldName: 'status',
          oldValue: 'active',
          newValue: 'deleted',
          changedBy: user.email || 'system',
          reason: 'User deleted',
        },
        user.uid
      );

      setMaterials((prev) => prev.filter((m) => m.id !== deleteId));
      toast({
        title: 'Success',
        description: 'Material review deleted successfully.',
      });
      setDeleteId(null);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/pqr/${pqrId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Material Review</h1>
            <p className="text-muted-foreground text-sm font-mono">PQR ID: {pqrId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/pqr/${pqrId}/materials/import`)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Import Excel
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push(`/dashboard/pqr/${pqrId}/materials/create`)}
          >
            <Plus className="h-4 w-4" />
            Add Material
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <ComplianceSummaryCards {...stats} />

      {/* Material Review Table */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Material & API Reviews</CardTitle>
            <div className="text-xs text-muted-foreground">
              {materials.length} record{materials.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <MaterialReviewTable
            data={materials.map((m) => ({
              id: m.id,
              batchNo: m.batchNo,
              materialName: m.materialName,
              materialType: m.materialType,
              manufacturerName: m.manufacturerName,
              supplierName: m.supplierName,
              arNo: m.arNo,
              lotNo: m.lotNo,
              usedQuantity: m.usedQuantity,
              unit: m.unit,
              qcStatus: m.qcStatus,
              avlStatus: m.avlStatus,
              complianceStatus: m.complianceStatus,
            }))}
            isLoading={isLoading}
            onView={(id) => {
              // Could add a detail view modal here
            }}
            onEdit={(id) => {
              router.push(`/dashboard/pqr/${pqrId}/materials/${id}/edit`);
            }}
            onDelete={(id) => {
              setDeleteId(id);
            }}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Material Review</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this material review? This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
