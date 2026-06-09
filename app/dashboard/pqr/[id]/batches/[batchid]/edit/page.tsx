'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { PageLoader } from '@/components/loaders/page-loader';

interface BatchData {
  id: string;
  pqr_id: string;
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
  release_date: string | null;
  remarks: string;
  created_at: string;
  updated_at: string;
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

export default function EditBatchPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [batch, setBatch] = useState<BatchData>({
    id: '',
    pqr_id: '',
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
    release_date: null,
    remarks: '',
    created_at: '',
    updated_at: '',
  });

  const pqrId = params.id as string;
  const batchId = params.batchId as string;

  useEffect(() => {
    const fetchBatchData = async () => {
      try {
        const { data, error } = await supabase
          .from('pqr_batches')
          .select('*')
          .eq('id', batchId)
          .eq('pqr_id', pqrId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setBatch(data as BatchData);
        } else {
          toast({
            title: 'Batch not found',
            description: 'The batch you are looking for does not exist.',
            variant: 'destructive',
          });
          router.push(`/dashboard/pqr/${pqrId}/batches`);
        }
      } catch (err: any) {
        toast({
          title: 'Error loading batch',
          description: err.message,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (pqrId && batchId) {
      fetchBatchData();
    }
  }, [pqrId, batchId, toast, router]);

  const handleSave = async () => {
    if (!batch.batch_no.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Batch number is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('pqr_batches')
        .update({
          batch_no: batch.batch_no,
          semi_finish_batch_no: batch.semi_finish_batch_no,
          finished_product_batch_no: batch.finished_product_batch_no,
          mfg_date: batch.mfg_date || null,
          exp_date: batch.exp_date || null,
          batch_size: batch.batch_size,
          manufactured_for: batch.manufactured_for,
          customer_name: batch.customer_name,
          market: batch.market,
          batch_status: batch.batch_status,
          release_date: batch.release_date || null,
          remarks: batch.remarks,
          updated_at: new Date().toISOString(),
        })
        .eq('id', batchId)
        .eq('pqr_id', pqrId);

      if (updateError) throw updateError;

      // Log to audit_logs
      await supabase.from('audit_logs').insert({
        user_id: user?.uid,
        user_name: user?.email || 'Unknown',
        user_role: user?.displayName || 'qa',
        action: 'UPDATE',
        module: 'PQR_BATCH',
        record_id: batchId,
        record_number: batch.batch_no,
        field_name: 'batch_details',
        old_value: 'previous_version',
        new_value: 'updated_version',
        ip_address: '',
        user_agent: '',
      });

      toast({
        title: 'Success',
        description: 'Batch updated successfully.',
      });

      router.push(`/dashboard/pqr/${pqrId}/batches`);
    } catch (err: any) {
      toast({
        title: 'Error saving batch',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
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
            onClick={() => router.push(`/dashboard/pqr/${pqrId}/batches`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Batch</h1>
            <p className="text-muted-foreground text-sm font-mono">{batch.batch_no}</p>
          </div>
        </div>
        <Button
          className="gap-2 bg-blue-600 hover:bg-blue-700"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Batch Information Card */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
          <CardTitle className="text-lg">Batch Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Batch Numbers Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="batch_no" className="text-sm font-semibold">
                Batch Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="batch_no"
                value={batch.batch_no}
                onChange={(e) => setBatch({ ...batch, batch_no: e.target.value })}
                placeholder="e.g., AMI-2024-001"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="semi_finish_batch_no" className="text-sm font-semibold">
                Semi-Finish Batch Number
              </Label>
              <Input
                id="semi_finish_batch_no"
                value={batch.semi_finish_batch_no}
                onChange={(e) =>
                  setBatch({ ...batch, semi_finish_batch_no: e.target.value })
                }
                placeholder="e.g., SF-2024-001"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finished_product_batch_no" className="text-sm font-semibold">
                Finished Product Batch Number
              </Label>
              <Input
                id="finished_product_batch_no"
                value={batch.finished_product_batch_no}
                onChange={(e) =>
                  setBatch({ ...batch, finished_product_batch_no: e.target.value })
                }
                placeholder="e.g., FP-2024-001"
                className="font-mono"
              />
            </div>
          </div>

          {/* Manufacturing & Expiry Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mfg_date" className="text-sm font-semibold">
                Manufacturing Date
              </Label>
              <Input
                id="mfg_date"
                type="date"
                value={batch.mfg_date}
                onChange={(e) => setBatch({ ...batch, mfg_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp_date" className="text-sm font-semibold">
                Expiry Date
              </Label>
              <Input
                id="exp_date"
                type="date"
                value={batch.exp_date}
                onChange={(e) => setBatch({ ...batch, exp_date: e.target.value })}
              />
            </div>
          </div>

          {/* Batch Size */}
          <div className="space-y-2">
            <Label htmlFor="batch_size" className="text-sm font-semibold">
              Batch Size (Units)
            </Label>
            <Input
              id="batch_size"
              value={batch.batch_size}
              onChange={(e) => setBatch({ ...batch, batch_size: e.target.value })}
              placeholder="e.g., 1000 or 100 L"
              type="text"
            />
          </div>
        </CardContent>
      </Card>

      {/* Manufacturing & Market Details Card */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10">
          <CardTitle className="text-lg">Manufacturing & Market Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufactured_for" className="text-sm font-semibold">
                Manufactured For
              </Label>
              <Input
                id="manufactured_for"
                value={batch.manufactured_for}
                onChange={(e) =>
                  setBatch({ ...batch, manufactured_for: e.target.value })
                }
                placeholder="e.g., In-house/Contract"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_name" className="text-sm font-semibold">
                Customer Name
              </Label>
              <Input
                id="customer_name"
                value={batch.customer_name}
                onChange={(e) => setBatch({ ...batch, customer_name: e.target.value })}
                placeholder="e.g., ABC Pharma Ltd."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="market" className="text-sm font-semibold">
              Market
            </Label>
            <Input
              id="market"
              value={batch.market}
              onChange={(e) => setBatch({ ...batch, market: e.target.value })}
              placeholder="e.g., India / Export"
            />
          </div>
        </CardContent>
      </Card>

      {/* Status & Release Details Card */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10">
          <CardTitle className="text-lg">Status & Release Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="batch_status" className="text-sm font-semibold">
                Batch Status
              </Label>
              <Select value={batch.batch_status} onValueChange={(value) => setBatch({ ...batch, batch_status: value })}>
                <SelectTrigger id="batch_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BATCH_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="release_date" className="text-sm font-semibold">
                Release Date
              </Label>
              <Input
                id="release_date"
                type="date"
                value={batch.release_date || ''}
                onChange={(e) =>
                  setBatch({ ...batch, release_date: e.target.value || null })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remarks Card */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10">
          <CardTitle className="text-lg">Additional Remarks</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="remarks" className="text-sm font-semibold">
              Remarks / Notes
            </Label>
            <textarea
              id="remarks"
              value={batch.remarks}
              onChange={(e) => setBatch({ ...batch, remarks: e.target.value })}
              placeholder="Enter any additional notes or remarks about this batch..."
              className="w-full min-h-24 px-3 py-2 border border-input rounded-md bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          Last updated: {batch.updated_at ? new Date(batch.updated_at).toLocaleString() : 'Never'}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/pqr/${pqrId}/batches`)}
          >
            Cancel
          </Button>
          <Button
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

