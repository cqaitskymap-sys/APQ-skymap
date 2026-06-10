'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/auth-context';
import {
  getPackagingMaterials,
  createPackagingMaterial,
  updatePackagingMaterial,
  deletePackagingMaterial,
  initializeDefaultPackagingMaterials,
  logAuditTrail,
  PackagingMaterial,
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
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Plus, Edit2, Trash2, Download, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { downloadCsv, parseCsv, printPage } from '@/lib/export-utils';

export default function PackagingMaterialMasterPage() {
  const { user, profile } = useAuth();
  const canManage = profile?.role === 'qa' || profile?.role === 'super_admin';
  const [materials, setMaterials] = useState<PackagingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [formData, setFormData] = useState<{
    materialCode: string;
    materialName: string;
    materialType: PackagingMaterial['materialType'];
    materialCategory: string;
    specificationNo: string;
    stpNo: string;
    packSize: string;
    unit: string;
    storageCondition: string;
    status: PackagingMaterial['status'];
    remarks: string;
  }>({
    materialCode: '',
    materialName: '',
    materialType: 'Primary Packaging' as const,
    materialCategory: '',
    specificationNo: '',
    stpNo: '',
    packSize: '',
    unit: '',
    storageCondition: '',
    status: 'Active' as const,
    remarks: '',
  });

  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPackagingMaterials({
        materialType: filterType === 'all' ? undefined : filterType,
        status: filterStatus === 'all' ? undefined : filterStatus,
        search: searchTerm || undefined,
      });
      setMaterials(data);
      setError('');
    } catch (err) {
      console.error('Error fetching materials:', err);
      setError('Failed to load packaging materials');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, searchTerm]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  async function handleInitializeDefaults() {
    try {
      if (!user?.uid) throw new Error('User not authenticated');
      await initializeDefaultPackagingMaterials(user.uid);
      await fetchMaterials();
      setSuccessMessage('Default materials initialized successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error initializing defaults:', err);
      setError('Failed to initialize default materials');
    }
  }

  async function handleSave() {
    try {
      if (!user?.uid) throw new Error('User not authenticated');

      if (!formData.materialCode || !formData.materialName) {
        setError('Material Code and Name are required');
        return;
      }

      if (editingId) {
        await updatePackagingMaterial(
          editingId,
          formData,
          user.uid
        );
        setSuccessMessage('Material updated successfully');
      } else {
        await createPackagingMaterial(formData, user.uid);
        setSuccessMessage('Material created successfully');
      }

      await fetchMaterials();
      setOpenDialog(false);
      resetForm();
      setError('');
    } catch (err) {
      console.error('Error saving material:', err);
      setError(err instanceof Error ? err.message : 'Failed to save material');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this material?')) return;

    try {
      if (!user?.uid) throw new Error('User not authenticated');
      await deletePackagingMaterial(id, user.uid);
      await fetchMaterials();
      setSuccessMessage('Material deleted successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error deleting material:', err);
      setError('Failed to delete material');
    }
  }

  function handleEdit(material: PackagingMaterial) {
    setFormData({
      materialCode: material.materialCode,
      materialName: material.materialName,
      materialType: material.materialType,
      materialCategory: material.materialCategory,
      specificationNo: material.specificationNo,
      stpNo: material.stpNo,
      packSize: material.packSize,
      unit: material.unit,
      storageCondition: material.storageCondition,
      status: material.status,
      remarks: material.remarks,
    });
    setEditingId(material.id);
    setOpenDialog(true);
  }

  function resetForm() {
    setFormData({
      materialCode: '',
      materialName: '',
      materialType: 'Primary Packaging',
      materialCategory: '',
      specificationNo: '',
      stpNo: '',
      packSize: '',
      unit: '',
      storageCondition: '',
      status: 'Active',
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

  const filteredMaterials = materials.filter((m) => {
    const matchesSearch =
      searchTerm === '' ||
      m.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.materialName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const materialTypes = ['Primary Packaging', 'Secondary Packaging', 'Tertiary Packaging'];
  const statuses = ['Active', 'Inactive', 'Discontinued'];
  const units = ['Vials', 'Pieces', 'Sheets', 'Boxes', 'Meters', 'Leaflets', 'Rolls'];

  function handleExport() {
    downloadCsv(
      'packaging-material-master.csv',
      ['Material Code', 'Material Name', 'Type', 'Category', 'Specification No', 'STP No', 'Pack Size', 'Unit', 'Storage Condition', 'Status', 'Remarks'],
      filteredMaterials.map((material) => [
        material.materialCode,
        material.materialName,
        material.materialType,
        material.materialCategory,
        material.specificationNo,
        material.stpNo,
        material.packSize,
        material.unit,
        material.storageCondition,
        material.status,
        material.remarks,
      ])
    );
    if (user?.uid) {
      void logAuditTrail({
        action: 'Export',
        entityType: 'Material',
        entityId: 'packaging_material_master',
        changes: { format: 'csv', count: filteredMaterials.length },
        performedBy: user.uid,
      });
    }
  }

  async function handleImport(file: File | undefined) {
    if (!file || !user?.uid) return;

    try {
      const rows = parseCsv(await file.text());
      const headers = rows.shift()?.map((header) => header.toLowerCase()) || [];
      const getCell = (row: string[], name: string) => row[headers.indexOf(name)] || '';

      for (const row of rows) {
        await createPackagingMaterial({
          materialCode: getCell(row, 'material code'),
          materialName: getCell(row, 'material name'),
          materialType: (getCell(row, 'type') || 'Primary Packaging') as PackagingMaterial['materialType'],
          materialCategory: getCell(row, 'category'),
          specificationNo: getCell(row, 'specification no'),
          stpNo: getCell(row, 'stp no'),
          packSize: getCell(row, 'pack size'),
          unit: getCell(row, 'unit'),
          storageCondition: getCell(row, 'storage condition'),
          status: (getCell(row, 'status') || 'Active') as PackagingMaterial['status'],
          remarks: getCell(row, 'remarks'),
        }, user.uid);
      }

      await logAuditTrail({
        action: 'Import',
        entityType: 'Material',
        entityId: 'packaging_material_master',
        changes: { filename: file.name, count: rows.length },
        performedBy: user.uid,
      });
      await fetchMaterials();
      setSuccessMessage(`${rows.length} materials imported successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import materials');
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Packaging Material Master</h1>
          <p className="text-gray-600 mt-1">Manage primary, secondary, and tertiary packaging materials</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline">Excel Export</Button>
          <Button onClick={printPage} variant="outline">PDF Export</Button>
          {canManage && (
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
              <Upload className="h-4 w-4" /> Excel Import
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  void handleImport(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          )}
          {canManage && <Button onClick={handleInitializeDefaults} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Initialize Defaults
          </Button>}
          {canManage && (
          <Dialog open={openDialog} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> New Material
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Material' : 'Create New Material'}</DialogTitle>
                <DialogDescription>
                  Fill in the details for the packaging material
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Material Code *
                    </label>
                    <Input
                      value={formData.materialCode}
                      onChange={(e) =>
                        setFormData({ ...formData, materialCode: e.target.value })
                      }
                      placeholder="e.g., PKG-PRI-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Material Name *
                    </label>
                    <Input
                      value={formData.materialName}
                      onChange={(e) =>
                        setFormData({ ...formData, materialName: e.target.value })
                      }
                      placeholder="e.g., Glass Vial 2ml"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Material Type
                    </label>
                    <Select value={formData.materialType} onValueChange={(value: any) =>
                      setFormData({ ...formData, materialType: value })
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {materialTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Material Category
                    </label>
                    <Input
                      value={formData.materialCategory}
                      onChange={(e) =>
                        setFormData({ ...formData, materialCategory: e.target.value })
                      }
                      placeholder="e.g., Glass Vials"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Specification No
                    </label>
                    <Input
                      value={formData.specificationNo}
                      onChange={(e) =>
                        setFormData({ ...formData, specificationNo: e.target.value })
                      }
                      placeholder="e.g., SPEC-2024-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      STP No
                    </label>
                    <Input
                      value={formData.stpNo}
                      onChange={(e) =>
                        setFormData({ ...formData, stpNo: e.target.value })
                      }
                      placeholder="e.g., STP-2024-001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Pack Size
                    </label>
                    <Input
                      value={formData.packSize}
                      onChange={(e) =>
                        setFormData({ ...formData, packSize: e.target.value })
                      }
                      placeholder="e.g., 2ml"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <Select value={formData.unit} onValueChange={(value) =>
                      setFormData({ ...formData, unit: value })
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <Select value={formData.status} onValueChange={(value: any) =>
                      setFormData({ ...formData, status: value })
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Storage Condition
                  </label>
                  <Input
                    value={formData.storageCondition}
                    onChange={(e) =>
                      setFormData({ ...formData, storageCondition: e.target.value })
                    }
                    placeholder="e.g., Room Temperature, Dry Place"
                  />
                </div>

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
                  {editingId ? 'Update' : 'Create'} Material
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <Input
                placeholder="Search by code or name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Material Type
              </label>
              <Select value={filterType} onValueChange={(value) => {
                setFilterType(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {materialTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select value={filterStatus} onValueChange={(value) => {
                setFilterStatus(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Materials ({filteredMaterials.length})</CardTitle>
          <CardDescription>
            Showing {filteredMaterials.length} of {materials.length} materials
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading materials...</div>
          ) : filteredMaterials.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No materials found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Pack Size</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-medium">{material.materialCode}</TableCell>
                      <TableCell>{material.materialName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{material.materialType}</Badge>
                      </TableCell>
                      <TableCell>{material.materialCategory}</TableCell>
                      <TableCell>{material.packSize}</TableCell>
                      <TableCell>{material.unit}</TableCell>
                      <TableCell className="text-xs">{material.storageCondition}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            material.status === 'Active'
                              ? 'default'
                              : material.status === 'Inactive'
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {material.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canManage && <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(material)}
                            className="gap-1"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </Button>}
                          {canManage && <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(material.id)}
                            className="gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
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
