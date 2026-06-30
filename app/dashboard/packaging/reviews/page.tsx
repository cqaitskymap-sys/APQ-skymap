'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import {
  getPackagingReviews,
  getPackagingMaterials,
  createPackagingReview,
  updatePackagingReview,
  deletePackagingReview,
  PackagingReview,
  PackagingMaterial,
  logAuditTrail,
} from '@/lib/packaging-service';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Plus, Edit2, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { downloadCsv, printPage } from '@/lib/export-utils';
import { useSearchParams } from 'next/navigation';

export default function PackagingReviewPage() {
  const { user, profile } = useAuth();
  const canCreate = profile?.role === 'qa' || profile?.role === 'super_admin';
  const canEdit = canCreate || profile?.role === 'qc' || profile?.role === 'warehouse';
  const searchParams = useSearchParams();
  const linkedPqrId = searchParams.get('pqrId') || '';
  const [reviews, setReviews] = useState<PackagingReview[]>([]);
  const [materials, setMaterials] = useState<PackagingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompliance, setFilterCompliance] = useState('all');
  const [filterReconciliation, setFilterReconciliation] = useState('all');

  const [formData, setFormData] = useState({
    pqrId: linkedPqrId,
    batchNo: '',
    productName: '',
    packagingMaterialId: '',
    packagingMaterial: '',
    materialCode: '',
    materialType: '',
    manufacturer: '',
    supplier: '',
    vendorAvlStatus: 'Pending' as const,
    arNo: '',
    lotNo: '',
    quantityReceived: 0,
    quantityIssued: 0,
    quantityUsed: 0,
    quantityRejected: 0,
    quantityReturned: 0,
    unit: '',
    mfgDate: '',
    expDate: '',
    coaAvailable: false,
    qcStatus: 'Pending' as const,
    specificationNo: '',
    stpNo: '',
    remarks: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [reviewsData, materialsData] = await Promise.all([
        getPackagingReviews({
          pqrId: linkedPqrId || undefined,
          complianceStatus: filterCompliance === 'all' ? undefined : filterCompliance,
        }),
        getPackagingMaterials(),
      ]);
      setReviews(reviewsData);
      setMaterials(materialsData);
      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load packaging reviews');
    } finally {
      setLoading(false);
    }
  }, [linkedPqrId, filterCompliance]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave() {
    try {
      if (!user?.uid) throw new Error('User not authenticated');

      if (!formData.batchNo || !formData.packagingMaterial) {
        setError('Batch Number and Packaging Material are required');
        return;
      }

      // Validate quantities
      const received = formData.quantityReceived;
      const used = formData.quantityUsed;
      const rejected = formData.quantityRejected;
      const returned = formData.quantityReturned;
      const total = used + rejected + returned;

      if (total > received) {
        setError('Total of Used, Rejected, and Returned quantities cannot exceed Received quantity');
        return;
      }

      if (editingId) {
        await updatePackagingReview(editingId, formData, user.uid);
        setSuccessMessage('Review updated successfully');
      } else {
        await createPackagingReview(formData, user.uid);
        setSuccessMessage('Review created successfully');
      }

      await fetchData();
      setOpenDialog(false);
      resetForm();
      setError('');
    } catch (err) {
      console.error('Error saving review:', err);
      setError(err instanceof Error ? err.message : 'Failed to save review');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this review?')) return;

    try {
      if (!user?.uid) throw new Error('User not authenticated');
      await deletePackagingReview(id, user.uid);
      await fetchData();
      setSuccessMessage('Review deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error deleting review:', err);
      setError('Failed to delete review');
    }
  }

  function handleEdit(review: PackagingReview) {
    setFormData({
      pqrId: review.pqrId,
      batchNo: review.batchNo,
      productName: review.productName,
      packagingMaterialId: review.packagingMaterialId,
      packagingMaterial: review.packagingMaterial,
      materialCode: review.materialCode,
      materialType: review.materialType,
      manufacturer: review.manufacturer,
      supplier: review.supplier,
      vendorAvlStatus: review.vendorAvlStatus as any,
      arNo: review.arNo,
      lotNo: review.lotNo,
      quantityReceived: review.quantityReceived,
      quantityIssued: review.quantityIssued,
      quantityUsed: review.quantityUsed,
      quantityRejected: review.quantityRejected,
      quantityReturned: review.quantityReturned,
      unit: review.unit,
      mfgDate: review.mfgDate,
      expDate: review.expDate,
      coaAvailable: review.coaAvailable,
      qcStatus: review.qcStatus as any,
      specificationNo: review.specificationNo,
      stpNo: review.stpNo,
      remarks: review.remarks,
    });
    setEditingId(review.id);
    setOpenDialog(true);
  }

  function resetForm() {
    setFormData({
      pqrId: linkedPqrId,
      batchNo: '',
      productName: '',
      packagingMaterialId: '',
      packagingMaterial: '',
      materialCode: '',
      materialType: '',
      manufacturer: '',
      supplier: '',
      vendorAvlStatus: 'Pending',
      arNo: '',
      lotNo: '',
      quantityReceived: 0,
      quantityIssued: 0,
      quantityUsed: 0,
      quantityRejected: 0,
      quantityReturned: 0,
      unit: '',
      mfgDate: '',
      expDate: '',
      coaAvailable: false,
      qcStatus: 'Pending',
      specificationNo: '',
      stpNo: '',
      remarks: '',
    });
    setEditingId(null);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      resetForm();
    }
    setOpenDialog(open);
  }

  function handleMaterialSelect(materialId: string) {
    const selected = materials.find((m) => m.id === materialId);
    if (selected) {
      setFormData({
        ...formData,
        packagingMaterialId: selected.id,
        packagingMaterial: selected.materialName,
        materialCode: selected.materialCode,
        materialType: selected.materialType,
        specificationNo: selected.specificationNo,
        stpNo: selected.stpNo,
        unit: selected.unit,
      });
    }
  }

  const balanceQty =
    formData.quantityReceived -
    (formData.quantityUsed + formData.quantityRejected + formData.quantityReturned);
  const isReconciled = balanceQty === 0;

  const filteredReviews = reviews.filter((r) => {
    const matchesSearch =
      searchTerm === '' ||
      r.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.packagingMaterial.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCompliance =
      filterCompliance === 'all' || r.complianceStatus === filterCompliance;

    const matchesReconciliation =
      filterReconciliation === 'all' || r.reconciliationStatus === filterReconciliation;

    return matchesSearch && matchesCompliance && matchesReconciliation;
  });

  function handleExport() {
    downloadCsv(
      'packaging-reviews.csv',
      ['PQR ID', 'Batch No', 'Product', 'Material', 'Code', 'Type', 'Manufacturer', 'Supplier', 'AVL Status', 'AR No', 'Lot No', 'Received', 'Issued', 'Used', 'Rejected', 'Returned', 'Balance', 'Unit', 'MFG Date', 'EXP Date', 'COA', 'QC Status', 'Compliance', 'Reconciliation', 'Remarks'],
      filteredReviews.map((review) => [
        review.pqrId, review.batchNo, review.productName, review.packagingMaterial,
        review.materialCode, review.materialType, review.manufacturer, review.supplier,
        review.vendorAvlStatus, review.arNo, review.lotNo, review.quantityReceived,
        review.quantityIssued, review.quantityUsed, review.quantityRejected,
        review.quantityReturned, review.balanceQty, review.unit, review.mfgDate,
        review.expDate, review.coaAvailable ? 'Yes' : 'No', review.qcStatus,
        review.complianceStatus, review.reconciliationStatus, review.remarks,
      ])
    );
    if (user?.uid) {
      void logAuditTrail({
        action: 'Export',
        entityType: 'Review',
        entityId: linkedPqrId || 'all',
        changes: { format: 'csv', count: filteredReviews.length },
        performedBy: user.uid,
      });
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Packaging Material Review</h1>
          <p className="text-gray-600 mt-1">Track and manage all packaging material lots with auto-reconciliation</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport}>Excel Export</Button>
          <Button variant="outline" onClick={printPage}>PDF Export</Button>
        {canCreate && <Dialog open={openDialog} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> New Review
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-screen overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Review' : 'Create New Packaging Review'}</DialogTitle>
              <DialogDescription>
                Enter packaging material details. Balance Qty will auto-calculate.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* PQR & Batch Info */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <h3 className="font-semibold mb-3">PQR & Batch Information</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PQR ID
                    </label>
                    <Input
                      value={formData.pqrId}
                      onChange={(e) =>
                        setFormData({ ...formData, pqrId: e.target.value })
                      }
                      placeholder="e.g., PQR-2024-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Batch Number *
                    </label>
                    <Input
                      value={formData.batchNo}
                      onChange={(e) =>
                        setFormData({ ...formData, batchNo: e.target.value })
                      }
                      placeholder="e.g., BATCH-001"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name
                    </label>
                    <Input
                      value={formData.productName}
                      onChange={(e) =>
                        setFormData({ ...formData, productName: e.target.value })
                      }
                      placeholder="e.g., Aspirin 500mg"
                    />
                  </div>
                </div>
              </div>

              {/* Material Info */}
              <div className="border rounded-lg p-4 bg-purple-50">
                <h3 className="font-semibold mb-3">Packaging Material Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Packaging Material *
                    </label>
                    <Select value={formData.packagingMaterialId} onValueChange={handleMaterialSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.materialCode} - {m.materialName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Material Code
                    </label>
                    <Input
                      value={formData.materialCode}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <Input
                      value={formData.materialType}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Supplier Info */}
              <div className="border rounded-lg p-4 bg-green-50">
                <h3 className="font-semibold mb-3">Supplier & Documents</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Manufacturer
                    </label>
                    <Input
                      value={formData.manufacturer}
                      onChange={(e) =>
                        setFormData({ ...formData, manufacturer: e.target.value })
                      }
                      placeholder="Manufacturer name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supplier
                    </label>
                    <Input
                      value={formData.supplier}
                      onChange={(e) =>
                        setFormData({ ...formData, supplier: e.target.value })
                      }
                      placeholder="Supplier name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor AVL Status
                    </label>
                    <Select value={formData.vendorAvlStatus} onValueChange={(value: any) =>
                      setFormData({ ...formData, vendorAvlStatus: value })
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Not Approved">Not Approved</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={formData.coaAvailable}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, coaAvailable: checked as boolean })
                        }
                      />
                      <span className="text-sm font-medium">COA Available</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Lot & Date Info */}
              <div className="border rounded-lg p-4 bg-yellow-50">
                <h3 className="font-semibold mb-3">Lot Information & Dates</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      AR No
                    </label>
                    <Input
                      value={formData.arNo}
                      onChange={(e) =>
                        setFormData({ ...formData, arNo: e.target.value })
                      }
                      placeholder="e.g., AR-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lot No
                    </label>
                    <Input
                      value={formData.lotNo}
                      onChange={(e) =>
                        setFormData({ ...formData, lotNo: e.target.value })
                      }
                      placeholder="Lot number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      MFG Date
                    </label>
                    <Input
                      type="month"
                      value={(formData.mfgDate || '').slice(0, 7)}
                      onChange={(e) =>
                        setFormData({ ...formData, mfgDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      EXP Date
                    </label>
                    <Input
                      type="month"
                      value={(formData.expDate || '').slice(0, 7)}
                      onChange={(e) =>
                        setFormData({ ...formData, expDate: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Quantities - Auto Reconciliation */}
              <div className="border rounded-lg p-4 bg-red-50">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Quantities & Auto-Reconciliation
                </h3>
                <div className="grid grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Qty Received
                    </label>
                    <Input
                      type="number"
                      value={formData.quantityReceived}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantityReceived: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Qty Issued
                    </label>
                    <Input
                      type="number"
                      value={formData.quantityIssued}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantityIssued: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Qty Used
                    </label>
                    <Input
                      type="number"
                      value={formData.quantityUsed}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantityUsed: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Qty Rejected
                    </label>
                    <Input
                      type="number"
                      value={formData.quantityRejected}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantityRejected: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Qty Returned
                    </label>
                    <Input
                      type="number"
                      value={formData.quantityReturned}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantityReturned: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Auto-Calculation Display */}
                <div className="mt-4 p-3 bg-white border rounded flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Balance Quantity:</p>
                    <p className="text-2xl font-bold">{balanceQty}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isReconciled ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        <span className="text-green-600 font-semibold">Reconciled ✓</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                        <span className="text-red-600 font-semibold">Mismatch!</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* QC & Status */}
              <div className="border rounded-lg p-4 bg-indigo-50">
                <h3 className="font-semibold mb-3">QC Status & Specifications</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      QC Status
                    </label>
                    <Select value={formData.qcStatus} onValueChange={(value: any) =>
                      setFormData({ ...formData, qcStatus: value })
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <Input
                      value={formData.unit}
                      placeholder="Unit"
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <Textarea
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({ ...formData, remarks: e.target.value })
                  }
                  placeholder="Additional remarks..."
                  className="h-20"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingId ? 'Update' : 'Create'} Review
              </Button>
            </div>
          </DialogContent>
        </Dialog>}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <Input
                placeholder="Search by batch, code, material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Compliance Status
              </label>
              <Select value={filterCompliance} onValueChange={setFilterCompliance}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Compliant">Compliant</SelectItem>
                  <SelectItem value="Non-Compliant">Non-Compliant</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reconciliation
              </label>
              <Select value={filterReconciliation} onValueChange={setFilterReconciliation}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Matched">Matched</SelectItem>
                  <SelectItem value="Mismatch">Mismatch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Packaging Reviews ({filteredReviews.length})</CardTitle>
          <CardDescription>
            Showing {filteredReviews.length} of {reviews.length} reviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading reviews...</div>
          ) : filteredReviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No reviews found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch No</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Lot No</TableHead>
                    <TableHead>Qty Used</TableHead>
                    <TableHead>Qty Rejected</TableHead>
                    <TableHead>Qty Returned</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Reconciliation</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell className="font-medium">{review.batchNo}</TableCell>
                      <TableCell>{review.packagingMaterial}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{review.materialType}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{review.manufacturer}</TableCell>
                      <TableCell className="text-sm">{review.supplier}</TableCell>
                      <TableCell>{review.lotNo}</TableCell>
                      <TableCell className="text-center">{review.quantityUsed}</TableCell>
                      <TableCell className="text-center">{review.quantityRejected}</TableCell>
                      <TableCell className="text-center">{review.quantityReturned}</TableCell>
                      <TableCell className="text-center font-semibold">{review.balanceQty}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            review.reconciliationStatus === 'Matched'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {review.reconciliationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            review.complianceStatus === 'Compliant'
                              ? 'default'
                              : review.complianceStatus === 'Non-Compliant'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {review.complianceStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canEdit && <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(review)}
                          >
                            Edit
                          </Button>}
                          {canCreate && <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(review.id)}
                          >
                            Delete
                          </Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
