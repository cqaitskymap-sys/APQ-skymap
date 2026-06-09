'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { PageLoader } from '@/components/loaders/page-loader';

interface PqrDoc {
  id: string;
  product_name: string;
  generic_name: string;
  strength: string;
}

interface FormData {
  batch_no: string;
  semi_finish_batch_no: string;
  finished_product_batch_no: string;
  mfg_date: string;
  exp_date: string;
  batch_size: string;
  manufactured_for: string;
  customer_name: string;
  market: string;
  batch_status: string;
  release_date: string;
  remarks: string;
}

const BATCH_STATUS_OPTIONS = [
  { value: 'manufactured', label: 'Manufactured' },
  { value: 'released', label: 'Released' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'hold', label: 'Hold' },
  { value: 'reprocessed', label: 'Reprocessed' },
  { value: 'reworked', label: 'Reworked' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function CreateBatchPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const pqrId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pqrDoc, setPqrDoc] = useState<PqrDoc | null>(null);

  const [formData, setFormData] = useState<FormData>({
    batch_no: '',
    semi_finish_batch_no: '',
    finished_product_batch_no: '',
    mfg_date: '',
    exp_date: '',
    batch_size: '',
    manufactured_for: '',
    customer_name: '',
    market: '',
    batch_status: 'manufactured',
    release_date: '',
    remarks: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch PQR document on load
  useEffect(() => {
    const fetchPqrDoc = async () => {
      try {
        const { data } = await supabase
          .from('pqr_documents')
          .select('id, product_name, generic_name, strength')
          .eq('id', pqrId)
          .maybeSingle();

        if (data) {
          setPqrDoc(data as PqrDoc);
          // Pre-fill manufactured_for with product_name
          setFormData(prev => ({
            ...prev,
            manufactured_for: data.product_name,
          }));
        } else {
          toast({
            title: 'Error',
            description: 'PQR document not found',
            variant: 'destructive',
          });
          router.push('/dashboard/pqr');
        }
      } catch (err: any) {
        toast({
          title: 'Error',
          description: err.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    if (pqrId) {
      fetchPqrDoc();
    }
  }, [pqrId, router, toast]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.batch_no.trim()) {
      newErrors.batch_no = 'Batch number is required';
    }
    if (!formData.mfg_date) {
      newErrors.mfg_date = 'Manufacturing date is required';
    }
    if (!formData.exp_date) {
      newErrors.exp_date = 'Expiry date is required';
    }
    if (formData.mfg_date && formData.exp_date && formData.mfg_date >= formData.exp_date) {
      newErrors.exp_date = 'Expiry date must be after manufacturing date';
    }
    if (!formData.batch_size.trim()) {
      newErrors.batch_size = 'Batch size is required';
    }
    if (!formData.manufactured_for.trim()) {
      newErrors.manufactured_for = 'Manufactured for is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check batch_no uniqueness for this PQR
  const checkBatchNoUniqueness = async (batch_no: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('pqr_batches')
      .select('id')
      .eq('pqr_id', pqrId)
      .eq('batch_no', batch_no)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !data; // Return true if unique (no existing record)
  };

  // Handle form submission
  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the form errors',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Check batch_no uniqueness
      const isUnique = await checkBatchNoUniqueness(formData.batch_no);
      if (!isUnique) {
        setErrors(prev => ({
          ...prev,
          batch_no: 'Batch number already exists for this PQR',
        }));
        toast({
          title: 'Duplicate Batch Number',
          description: 'This batch number already exists for this PQR document',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }

      // Fetch product_id from product_master using product_name
      const { data: productData } = await supabase
        .from('product_master')
        .select('id')
        .eq('product_name', pqrDoc?.product_name)
        .maybeSingle();

      const productId = productData?.id || null;

      // Insert batch into pqr_batches table
      const { data: batchData, error: batchError } = await supabase
        .from('pqr_batches')
        .insert({
          pqr_id: pqrId,
          product_id: productId,
          batch_no: formData.batch_no,
          semi_finish_batch_no: formData.semi_finish_batch_no || null,
          finished_product_batch_no: formData.finished_product_batch_no || null,
          mfg_date: formData.mfg_date,
          exp_date: formData.exp_date,
          batch_size: formData.batch_size,
          manufactured_for: formData.manufactured_for,
          customer_name: formData.customer_name || null,
          market: formData.market || null,
          batch_status: formData.batch_status,
          release_date: formData.release_date || null,
          remarks: formData.remarks || null,
          created_by: user?.uid,
        })
        .select()
        .maybeSingle();

      if (batchError) throw batchError;

      // Log to audit_logs
      if (batchData) {
        await supabase.from('audit_logs').insert({
          user_id: user?.uid,
          user_name: user?.email || 'Unknown',
          user_role: user?.displayName || 'qa',
          action: 'CREATE',
          module: 'PQR_BATCH',
          record_id: batchData.id,
          record_number: formData.batch_no,
          field_name: 'batch',
          old_value: '',
          new_value: formData.batch_status,
          ip_address: '',
          user_agent: '',
        });
      }

      toast({
        title: 'Success',
        description: 'Batch created successfully',
      });

      router.push(`/dashboard/pqr/${pqrId}/batches`);
    } catch (err: any) {
      console.error('Error creating batch:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to create batch',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/pqr/${pqrId}/batches`)}
            className="h-9 w-9 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create New Batch</h1>
            <p className="text-muted-foreground text-sm">Add a new batch to PQR document</p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Batch'}
        </Button>
      </div>

      {/* PQR Summary Card */}
      {pqrDoc && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Product Name:</span>
                <p className="font-semibold">{pqrDoc.product_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Generic Name:</span>
                <p className="font-semibold">{pqrDoc.generic_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Strength:</span>
                <p className="font-semibold">{pqrDoc.strength}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card>
        <CardHeader className="bg-slate-50 dark:bg-slate-900/50">
          <CardTitle className="text-lg">Batch Information</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Row 1: Batch Numbers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="batch_no" className="text-sm font-semibold">
                Batch Number *
              </Label>
              <Input
                id="batch_no"
                className="mt-2"
                placeholder="e.g., BNO-2025-001"
                value={formData.batch_no}
                onChange={e =>
                  setFormData(prev => ({ ...prev, batch_no: e.target.value }))
                }
              />
              {errors.batch_no && (
                <p className="text-red-500 text-xs mt-1">{errors.batch_no}</p>
              )}
            </div>

            <div>
              <Label
                htmlFor="semi_finish_batch_no"
                className="text-sm font-semibold"
              >
                Semi-Finished Batch No.
              </Label>
              <Input
                id="semi_finish_batch_no"
                className="mt-2"
                placeholder="e.g., SFB-2025-001"
                value={formData.semi_finish_batch_no}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    semi_finish_batch_no: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label
                htmlFor="finished_product_batch_no"
                className="text-sm font-semibold"
              >
                Finished Product Batch No.
              </Label>
              <Input
                id="finished_product_batch_no"
                className="mt-2"
                placeholder="e.g., FPB-2025-001"
                value={formData.finished_product_batch_no}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    finished_product_batch_no: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {/* Row 2: Manufacturing & Expiry Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mfg_date" className="text-sm font-semibold">
                Manufacturing Date *
              </Label>
              <Input
                id="mfg_date"
                type="date"
                className="mt-2"
                value={formData.mfg_date}
                onChange={e =>
                  setFormData(prev => ({ ...prev, mfg_date: e.target.value }))
                }
              />
              {errors.mfg_date && (
                <p className="text-red-500 text-xs mt-1">{errors.mfg_date}</p>
              )}
            </div>

            <div>
              <Label htmlFor="exp_date" className="text-sm font-semibold">
                Expiry Date *
              </Label>
              <Input
                id="exp_date"
                type="date"
                className="mt-2"
                value={formData.exp_date}
                onChange={e =>
                  setFormData(prev => ({ ...prev, exp_date: e.target.value }))
                }
              />
              {errors.exp_date && (
                <p className="text-red-500 text-xs mt-1">{errors.exp_date}</p>
              )}
              {formData.mfg_date && formData.exp_date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Shelf life: {Math.floor((new Date(formData.exp_date).getTime() - new Date(formData.mfg_date).getTime()) / (1000 * 60 * 60 * 24))} days
                </p>
              )}
            </div>
          </div>

          {/* Row 3: Batch Size & Manufactured For */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="batch_size" className="text-sm font-semibold">
                Batch Size *
              </Label>
              <Input
                id="batch_size"
                className="mt-2"
                placeholder="e.g., 1000 units"
                value={formData.batch_size}
                onChange={e =>
                  setFormData(prev => ({ ...prev, batch_size: e.target.value }))
                }
              />
              {errors.batch_size && (
                <p className="text-red-500 text-xs mt-1">{errors.batch_size}</p>
              )}
            </div>

            <div>
              <Label
                htmlFor="manufactured_for"
                className="text-sm font-semibold"
              >
                Manufactured For *
              </Label>
              <Input
                id="manufactured_for"
                className="mt-2"
                value={formData.manufactured_for}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    manufactured_for: e.target.value,
                  }))
                }
              />
              {errors.manufactured_for && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.manufactured_for}
                </p>
              )}
            </div>
          </div>

          {/* Row 4: Customer & Market */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_name" className="text-sm font-semibold">
                Customer Name
              </Label>
              <Input
                id="customer_name"
                className="mt-2"
                placeholder="e.g., ABC Pharma Ltd."
                value={formData.customer_name}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    customer_name: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label htmlFor="market" className="text-sm font-semibold">
                Market
              </Label>
              <Input
                id="market"
                className="mt-2"
                placeholder="e.g., India, Export"
                value={formData.market}
                onChange={e =>
                  setFormData(prev => ({ ...prev, market: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Row 5: Batch Status & Release Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="batch_status" className="text-sm font-semibold">
                Batch Status
              </Label>
              <Select
                value={formData.batch_status}
                onValueChange={v =>
                  setFormData(prev => ({ ...prev, batch_status: v }))
                }
              >
                <SelectTrigger id="batch_status" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BATCH_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="release_date" className="text-sm font-semibold">
                Release Date
              </Label>
              <Input
                id="release_date"
                type="date"
                className="mt-2"
                value={formData.release_date}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    release_date: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {/* Row 6: Remarks */}
          <div>
            <Label htmlFor="remarks" className="text-sm font-semibold">
              Remarks
            </Label>
            <Textarea
              id="remarks"
              className="mt-2 min-h-24"
              placeholder="Any additional notes or remarks about this batch..."
              value={formData.remarks}
              onChange={e =>
                setFormData(prev => ({ ...prev, remarks: e.target.value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => router.push(`/dashboard/pqr/${pqrId}/batches`)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Create Batch'}
        </Button>
      </div>
    </div>
  );
}
