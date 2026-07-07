'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { PageLoader } from '@/components/loaders/page-loader';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { getPqrDocument, getPqrBatches } from '@/lib/pqr-service';
import {
  createMaterialReview,
  getMaterialMasters,
  getVendorMasters,
  logMaterialAudit,
} from '@/lib/material-service';
import type { MaterialReview } from '@/lib/material-schemas';

interface Batch {
  id: string;
  batch_no: string;
}

interface Material {
  id: string;
  material_code: string;
  material_name: string;
  material_type: string;
}

interface Vendor {
  id: string;
  vendor_id: string;
  vendor_name: string;
  avl_status: string;
}

interface PqrDoc {
  id: string;
  pqr_number: string;
  product_name: string;
  product_id?: string;
  productId?: string;
}

interface FormData {
  batch_no: string;
  material_type: string;
  material_name: string;
  material_id: string;
  material_code: string;
  manufacturer_name: string;
  supplier_name: string;
  vendor_id: string;
  avl_status: string;
  ar_no: string;
  grn_no: string;
  received_quantity: string;
  issued_quantity: string;
  used_quantity: string;
  unit: string;
  lot_no: string;
  mfg_date: string;
  exp_date: string;
  retest_date: string;
  qc_status: string;
  coa_available: string;
  specification_no: string;
  stp_no: string;
  test_result_summary: string;
  compliance_status: string;
  compliance_reasons: string[];
  remarks: string;
}

const FORM_MATERIAL_TYPE_TO_FIRESTORE: Record<string, MaterialReview['materialType']> = {
  api: 'API',
  raw_material: 'Raw Material',
  excipient: 'Excipient',
  solvent: 'Solvent',
  preservative: 'Preservative',
  buffer: 'Buffer',
  ph_adjuster: 'pH Adjuster',
};

const FIRESTORE_MATERIAL_TYPE_TO_FORM: Record<string, string> = {
  API: 'api',
  'Raw Material': 'raw_material',
  Excipient: 'excipient',
  Solvent: 'solvent',
  Preservative: 'preservative',
  Buffer: 'buffer',
  'pH Adjuster': 'ph_adjuster',
};

function avlToForm(status: string): string {
  const map: Record<string, string> = {
    Approved: 'approved',
    'Not Approved': 'not_approved',
    'Conditional Approved': 'conditional',
    Blocked: 'blocked',
  };
  return map[status] || status.toLowerCase().replace(/\s+/g, '_');
}

function avlToFirestore(status: string): MaterialReview['avlStatus'] {
  const map: Record<string, MaterialReview['avlStatus']> = {
    approved: 'Approved',
    not_approved: 'Not Approved',
    conditional: 'Conditional Approved',
    blocked: 'Blocked',
  };
  return map[status] || 'Not Approved';
}

function qcToFirestore(status: string): MaterialReview['qcStatus'] {
  const map: Record<string, MaterialReview['qcStatus']> = {
    approved: 'Approved',
    rejected: 'Rejected',
    under_test: 'Under Test',
    quarantine: 'Quarantine',
    retest_required: 'Retest Required',
  };
  return map[status] || 'Under Test';
}

function complianceToFirestore(status: string): MaterialReview['complianceStatus'] {
  const map: Record<string, MaterialReview['complianceStatus']> = {
    complies: 'Complies',
    does_not_comply: 'Does Not Comply',
    not_applicable: 'Not Applicable',
  };
  return map[status] || 'Not Applicable';
}

export default function CreateMaterialPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={8} />}>
      <CreateMaterialContent />
    </Suspense>
  );
}

function CreateMaterialContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const [pqr, setPqr] = useState<PqrDoc | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    batch_no: '',
    material_type: searchParams.get('material_type') || 'api',
    material_name: '',
    material_id: '',
    material_code: '',
    manufacturer_name: '',
    supplier_name: '',
    vendor_id: '',
    avl_status: 'not_approved',
    ar_no: '',
    grn_no: '',
    received_quantity: '',
    issued_quantity: '',
    used_quantity: '',
    unit: '',
    lot_no: '',
    mfg_date: '',
    exp_date: '',
    retest_date: '',
    qc_status: 'under_test',
    coa_available: 'no',
    specification_no: '',
    stp_no: '',
    test_result_summary: '',
    compliance_status: 'not_applicable',
    compliance_reasons: [],
    remarks: '',
  });

  useEffect(() => {
    const fetch = async () => {
      const id = params.id as string;

      try {
        const pqrData = await getPqrDocument(id);
        if (pqrData) {
          setPqr({
            id: pqrData.id!,
            pqr_number: pqrData.pqr_number,
            product_name: pqrData.product_name,
          });
        }

        const batchesData = await getPqrBatches(id);
        setBatches(
          batchesData
            .map((b) => {
              const row = b as { id: unknown; batch_no?: unknown; batchNo?: unknown };
              return {
                id: String(row.id ?? ''),
                batch_no: String(row.batch_no ?? row.batchNo ?? ''),
              };
            })
            .filter((b) => b.batch_no),
        );

        const materialsData = await getMaterialMasters({ status: 'Active' });
        setMaterials(
          materialsData.map((m) => ({
            id: m.id!,
            material_code: m.materialCode,
            material_name: m.materialName,
            material_type: FIRESTORE_MATERIAL_TYPE_TO_FORM[m.materialType] || m.materialType.toLowerCase(),
          })),
        );

        const vendorsData = await getVendorMasters({ status: 'Active' });
        setVendors(
          vendorsData.map((v) => ({
            id: v.id!,
            vendor_id: v.id!,
            vendor_name: v.vendorName,
            avl_status: avlToForm(v.avlStatus),
          })),
        );
      } catch (error) {
        console.error('Failed to load material review form data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load form data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    void fetch();
  }, [params.id, toast]);

  // Auto-fill material_code when material selected
  const handleMaterialChange = (materialId: string) => {
    const selected = materials.find((m) => m.id === materialId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        material_id: materialId,
        material_name: selected.material_name,
        material_code: selected.material_code,
        specification_no: '',
        stp_no: '',
      }));
    }
  };

  // Auto-fill avl_status when vendor selected
  const handleVendorChange = (vendorId: string) => {
    const selected = vendors.find((v) => v.vendor_id === vendorId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        vendor_id: vendorId,
        avl_status: selected.avl_status,
      }));
    }
  };

  // Auto-compliance logic
  const calculateCompliance = (updatedForm: FormData) => {
    const today = new Date().toISOString().split('T')[0];
    const reasons: string[] = [];

    if (updatedForm.avl_status !== 'approved') {
      reasons.push('Vendor AVL status not approved');
    }
    if (updatedForm.qc_status !== 'approved') {
      reasons.push('QC status not approved');
    }
    if (updatedForm.coa_available !== 'yes') {
      reasons.push('COA not available');
    }
    if (updatedForm.exp_date && updatedForm.exp_date <= today) {
      reasons.push('Material expired');
    }
    if (updatedForm.used_quantity && updatedForm.issued_quantity) {
      const used = parseFloat(updatedForm.used_quantity);
      const issued = parseFloat(updatedForm.issued_quantity);
      if (used > issued) {
        reasons.push('Used quantity exceeds issued quantity');
      }
    }

    const status = reasons.length === 0 ? 'complies' : 'does_not_comply';

    return { status, reasons };
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };

    // Recalculate compliance when relevant fields change
    if (['avl_status', 'qc_status', 'coa_available', 'exp_date', 'used_quantity', 'issued_quantity'].includes(name)) {
      const { status, reasons } = calculateCompliance(updated);
      updated.compliance_status = status;
      updated.compliance_reasons = reasons;
    }

    setFormData(updated);
  };

  const handleSelectChange = (name: string, value: string) => {
    const updated = { ...formData, [name]: value };

    if (name === 'material_name') {
      handleMaterialChange(value);
    } else if (name === 'vendor_id') {
      handleVendorChange(value);
    }

    // Recalculate compliance when relevant fields change
    if (['avl_status', 'qc_status', 'coa_available'].includes(name)) {
      const { status, reasons } = calculateCompliance(updated);
      updated.compliance_status = status;
      updated.compliance_reasons = reasons;
    }

    setFormData(updated);
  };

  const handleSave = async () => {
    if (!formData.batch_no || !formData.material_name || !formData.ar_no) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const userId = user?.uid || 'system';
      const selectedBatch = batches.find((b) => b.batch_no === formData.batch_no);

      const savePromise = createMaterialReview(
        {
          pqrId: params.id as string,
          productId: pqr?.product_id || pqr?.productId || '',
          productName: pqr?.product_name || '',
          batchId: selectedBatch?.id || '',
          batchNo: formData.batch_no,
          materialType: FORM_MATERIAL_TYPE_TO_FIRESTORE[formData.material_type] || 'API',
          materialId: formData.material_id || formData.material_name,
          materialName: formData.material_name,
          materialCode: formData.material_code,
          manufacturerName: formData.manufacturer_name,
          supplierName: formData.supplier_name,
          vendorId: formData.vendor_id || '',
          avlStatus: avlToFirestore(formData.avl_status),
          arNo: formData.ar_no,
          grnNo: formData.grn_no,
          receivedQuantity: parseFloat(formData.received_quantity) || 0,
          issuedQuantity: parseFloat(formData.issued_quantity) || 0,
          usedQuantity: parseFloat(formData.used_quantity) || 0,
          unit: formData.unit,
          lotNo: formData.lot_no,
          mfgDate: formData.mfg_date || '',
          expDate: formData.exp_date || '',
          retestDate: formData.retest_date || null,
          qcStatus: qcToFirestore(formData.qc_status),
          coaAvailable: formData.coa_available === 'yes' ? 'Yes' : 'No',
          specificationNo: formData.specification_no,
          stpNo: formData.stp_no,
          testResultSummary: formData.test_result_summary,
          complianceStatus: complianceToFirestore(formData.compliance_status),
          complianceReasons: formData.compliance_reasons,
          remarks: formData.remarks,
        },
        userId,
      );

      await Promise.race([
        savePromise,
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error('Save timed out after 30 seconds. Check your network and try again.')),
            30000,
          ),
        ),
      ]);

      await Promise.race([
        logMaterialAudit(
          {
            module: 'material_review',
            recordId: formData.ar_no,
            fieldName: 'material_review',
            oldValue: '',
            newValue: formData.material_name,
            changedBy: userId,
            reason: 'Created from PQR material review form',
          },
          userId,
        ),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error('Audit log timed out.')), 15000),
        ),
      ]);

      toast({
        title: 'Success',
        description: 'Material review created successfully',
      });

      router.push(`/dashboard/pqr/${params.id}/materials`);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create material review',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!pqr) return <div className="p-12 text-center"><p>PQR document not found</p></div>;

  const filteredMaterials = materials.filter((m) => {
    if (formData.material_type === 'api') {
      return m.material_type === 'api';
    } else {
      return ['raw_material', 'excipient', 'solvent', 'preservative', 'buffer', 'ph_adjuster'].includes(m.material_type);
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/dashboard/pqr/${pqr.id}/materials`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Material Review</h1>
          <p className="text-sm text-muted-foreground">{pqr.pqr_number} • {pqr.product_name}</p>
        </div>
      </div>

      {/* Compliance Status Info */}
      {formData.compliance_reasons.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-400 text-sm mb-2">Compliance Issues Detected:</p>
                <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
                  {formData.compliance_reasons.map((reason, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span>•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Material Review Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Batch Information */}
            <div className="space-y-2">
              <Label htmlFor="batch_no" className="text-sm font-semibold">Batch No *</Label>
              <Select value={formData.batch_no} onValueChange={(v) => setFormData({ ...formData, batch_no: v })}>
                <SelectTrigger id="batch_no">
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.batch_no}>{b.batch_no}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="material_type" className="text-sm font-semibold">Material Type *</Label>
              <Select value={formData.material_type} onValueChange={(v) => setFormData({ ...formData, material_type: v })}>
                <SelectTrigger id="material_type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="raw_material">Raw Material</SelectItem>
                  <SelectItem value="excipient">Excipient</SelectItem>
                  <SelectItem value="solvent">Solvent</SelectItem>
                  <SelectItem value="preservative">Preservative</SelectItem>
                  <SelectItem value="buffer">Buffer</SelectItem>
                  <SelectItem value="ph_adjuster">pH Adjuster</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Material Information */}
            <div className="space-y-2">
              <Label htmlFor="material_name" className="text-sm font-semibold">Material Name *</Label>
              <Select value={formData.material_id} onValueChange={handleMaterialChange}>
                <SelectTrigger id="material_name">
                  <SelectValue placeholder="Select material" />
                </SelectTrigger>
                <SelectContent>
                  {filteredMaterials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.material_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="material_code" className="text-sm font-semibold">Material Code</Label>
              <Input
                id="material_code"
                value={formData.material_code}
                readOnly
                className="bg-muted text-sm"
              />
            </div>

            {/* Vendor Information */}
            <div className="space-y-2">
              <Label htmlFor="vendor_id" className="text-sm font-semibold">Vendor / Supplier</Label>
              <Select value={formData.vendor_id} onValueChange={handleVendorChange}>
                <SelectTrigger id="vendor_id">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avl_status" className="text-sm font-semibold">AVL Status</Label>
              <Input
                id="avl_status"
                value={formData.avl_status}
                readOnly
                className="bg-muted text-sm capitalize"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturer_name" className="text-sm">Manufacturer Name</Label>
              <Input
                id="manufacturer_name"
                name="manufacturer_name"
                value={formData.manufacturer_name}
                onChange={handleInputChange}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_name" className="text-sm">Supplier Name</Label>
              <Input
                id="supplier_name"
                name="supplier_name"
                value={formData.supplier_name}
                onChange={handleInputChange}
                className="text-sm"
              />
            </div>

            {/* Document References */}
            <div className="space-y-2">
              <Label htmlFor="ar_no" className="text-sm font-semibold">AR No *</Label>
              <Input
                id="ar_no"
                name="ar_no"
                value={formData.ar_no}
                onChange={handleInputChange}
                placeholder="Analysis Report No"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="grn_no" className="text-sm">GRN No</Label>
              <Input
                id="grn_no"
                name="grn_no"
                value={formData.grn_no}
                onChange={handleInputChange}
                placeholder="Goods Receipt Note No"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lot_no" className="text-sm">Lot No</Label>
              <Input
                id="lot_no"
                name="lot_no"
                value={formData.lot_no}
                onChange={handleInputChange}
                className="text-sm"
              />
            </div>

            {/* Quantity Information */}
            <div className="space-y-2">
              <Label htmlFor="received_quantity" className="text-sm">Received Quantity</Label>
              <Input
                id="received_quantity"
                name="received_quantity"
                value={formData.received_quantity}
                onChange={handleInputChange}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issued_quantity" className="text-sm">Issued Quantity</Label>
              <Input
                id="issued_quantity"
                name="issued_quantity"
                value={formData.issued_quantity}
                onChange={handleInputChange}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="used_quantity" className="text-sm">Used Quantity</Label>
              <Input
                id="used_quantity"
                name="used_quantity"
                value={formData.used_quantity}
                onChange={handleInputChange}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit" className="text-sm">Unit</Label>
              <Input
                id="unit"
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                placeholder="kg, liter, etc."
                className="text-sm"
              />
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <Label htmlFor="mfg_date" className="text-sm">Manufacturing Date</Label>
              <Input
                id="mfg_date"
                name="mfg_date"
                type="month"
                value={(formData.mfg_date || '').slice(0, 7)}
                onChange={handleInputChange}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exp_date" className="text-sm">Expiry Date</Label>
              <Input
                id="exp_date"
                name="exp_date"
                type="month"
                value={(formData.exp_date || '').slice(0, 7)}
                onChange={handleInputChange}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retest_date" className="text-sm">Retest Date</Label>
              <Input
                id="retest_date"
                name="retest_date"
                type="date"
                value={formData.retest_date}
                onChange={handleInputChange}
                className="text-sm"
              />
            </div>

            {/* QC & COA */}
            <div className="space-y-2">
              <Label htmlFor="qc_status" className="text-sm font-semibold">QC Status</Label>
              <Select value={formData.qc_status} onValueChange={(v) => handleSelectChange('qc_status', v)}>
                <SelectTrigger id="qc_status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="under_test">Under Test</SelectItem>
                  <SelectItem value="quarantine">Quarantine</SelectItem>
                  <SelectItem value="retest_required">Retest Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coa_available" className="text-sm font-semibold">COA Available</Label>
              <Select value={formData.coa_available} onValueChange={(v) => handleSelectChange('coa_available', v)}>
                <SelectTrigger id="coa_available">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Specifications */}
            <div className="space-y-2">
              <Label htmlFor="specification_no" className="text-sm">Specification No</Label>
              <Input
                id="specification_no"
                name="specification_no"
                value={formData.specification_no}
                onChange={handleInputChange}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stp_no" className="text-sm">STP No</Label>
              <Input
                id="stp_no"
                name="stp_no"
                value={formData.stp_no}
                onChange={handleInputChange}
                className="text-sm"
              />
            </div>

            {/* Full Width Fields */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="test_result_summary" className="text-sm">Test Result Summary</Label>
              <textarea
                id="test_result_summary"
                name="test_result_summary"
                value={formData.test_result_summary}
                onChange={handleInputChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={3}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="remarks" className="text-sm">Remarks</Label>
              <textarea
                id="remarks"
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={3}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="compliance_status" className="text-sm font-semibold">Compliance Status</Label>
              <Input
                id="compliance_status"
                value={formData.compliance_status}
                readOnly
                className="bg-muted text-sm capitalize font-semibold"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => router.push(`/dashboard/pqr/${pqr.id}/materials`)}
        >
          Cancel
        </Button>
        <Button
          className="gap-2"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Review'}
        </Button>
      </div>
    </div>
  );
}
