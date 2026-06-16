'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Link2, Unlink, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { cpvPermissions } from '@/lib/cpv';
import type { CpvProductRecord, LinkedParameterRow } from '@/lib/cpv-product-master';
import {
  fetchCpvProductById,
  fetchLinkedParameters,
  fetchActiveParametersByType,
  fetchProductBatches,
  fetchProductCpvReviews,
  fetchProductAuditTrail,
  fetchCppCqaParameterCollections,
  linkCpvParameter,
  unlinkCpvParameter,
  fetchAdminProductsForImport,
  updateCpvProduct,
} from '@/lib/cpv-product-master-service';
import { CpvPageHeader } from './cpv-page-header';
import { CpvProductFormSheet } from './cpv-product-form-sheet';
import { KpiCard, StatusBadge } from '@/components/cpv/cpv-ui';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { EmptyState } from '@/components/admin/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { AdminProduct } from '@/lib/admin/schemas';
import type { CpvProductFormData } from '@/lib/cpv-product-master';

function ParameterTable({
  rows,
  onUnlink,
  canEdit,
}: {
  rows: LinkedParameterRow[];
  onUnlink?: (id: string) => void;
  canEdit?: boolean;
}) {
  if (!rows.length) {
    return <EmptyState title="No linked parameters" message="Link active parameters from Parameter Master." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {['Code', 'Name', 'Type', 'Stage', 'LSL', 'USL', 'Target', 'Unit', 'Criticality', 'Status', ''].map((h) => (
              <TableHead key={h || 'action'}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.parameterCode}</TableCell>
              <TableCell>{r.parameterName}</TableCell>
              <TableCell>{r.parameterType}</TableCell>
              <TableCell>{r.processStage || '—'}</TableCell>
              <TableCell>{r.lsl || '—'}</TableCell>
              <TableCell>{r.usl || '—'}</TableCell>
              <TableCell>{r.target || '—'}</TableCell>
              <TableCell>{r.unit || '—'}</TableCell>
              <TableCell>{r.criticality || '—'}</TableCell>
              <TableCell><StatusBadge status={r.status} /></TableCell>
              <TableCell>
                {canEdit && onUnlink && (
                  <Button size="sm" variant="ghost" onClick={() => onUnlink(r.id)}>
                    <Unlink className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CpvProductDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const role = profile?.role;
  const canManage = cpvPermissions.canManageCpvProducts(role) && !cpvPermissions.isReadOnly(role);

  const [product, setProduct] = useState<CpvProductRecord | null>(null);
  const [cppParams, setCppParams] = useState<LinkedParameterRow[]>([]);
  const [cqaParams, setCqaParams] = useState<LinkedParameterRow[]>([]);
  const [batches, setBatches] = useState<Record<string, unknown>[]>([]);
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown>[]>([]);
  const [trendCpp, setTrendCpp] = useState(0);
  const [trendCqa, setTrendCqa] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkType, setLinkType] = useState<'CPP' | 'CQA'>('CPP');
  const [linkParamId, setLinkParamId] = useState('');
  const [availableParams, setAvailableParams] = useState<LinkedParameterRow[]>([]);
  const [adminProducts, setAdminProducts] = useState<AdminProduct[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const actor = { id: user?.uid || 'system', name: profile?.full_name || 'System' };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchCpvProductById(id);
      if (!p) {
        setError('CPV product not found.');
        setLoading(false);
        return;
      }
      setProduct(p);
      const [cpp, cqa, batchRows, reviewRows, audit, coll, admin] = await Promise.all([
        fetchLinkedParameters(p.linkedCppParameterIds || []),
        fetchLinkedParameters(p.linkedCqaParameterIds || []),
        fetchProductBatches(p),
        fetchProductCpvReviews(p),
        fetchProductAuditTrail(id),
        fetchCppCqaParameterCollections(p),
        fetchAdminProductsForImport(),
      ]);
      setCppParams(cpp);
      setCqaParams(cqa);
      setBatches(batchRows);
      setReviews(reviewRows);
      setAuditTrail(audit);
      setTrendCpp(coll.cpp.length);
      setTrendCqa(coll.cqa.length);
      setAdminProducts(admin);
    } catch {
      setError('Failed to load product profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const openLinkDialog = async (type: 'CPP' | 'CQA') => {
    setLinkType(type);
    setLinkParamId('');
    const params = await fetchActiveParametersByType(type);
    setAvailableParams(params.map((p) => ({
      id: p.id || '',
      parameterCode: p.parameterCode,
      parameterName: p.parameterName,
      parameterType: p.parameterType,
      processStage: p.processStage || '',
      lsl: p.lsl || '',
      usl: p.usl || '',
      target: p.target || '',
      unit: p.unit || '',
      criticality: p.criticality || '',
      status: p.status || 'Active',
    })));
    setLinkOpen(true);
  };

  const handleLink = async () => {
    if (!product || !linkParamId) return;
    setSubmitting(true);
    const { error: err } = await linkCpvParameter(product.id, linkParamId, linkType, actor, product);
    setSubmitting(false);
    if (err) toast.error(err);
    else {
      toast.success(`${linkType} parameter linked`);
      setLinkOpen(false);
      await load();
    }
  };

  const handleUnlink = async (paramId: string, type: 'CPP' | 'CQA') => {
    if (!product) return;
    const { error: err } = await unlinkCpvParameter(product.id, paramId, type, actor, product);
    if (err) toast.error(err);
    else {
      toast.success('Parameter unlinked');
      await load();
    }
  };

  const handleSave = async (data: CpvProductFormData) => {
    if (!product) return;
    setSubmitting(true);
    const { error: err } = await updateCpvProduct(product.id, data, actor, product);
    setSubmitting(false);
    if (err) toast.error(err);
    else {
      toast.success('Product updated');
      setFormOpen(false);
      await load();
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingSkeleton rows={2} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorCard title="Not Found" message={error || 'Product not found'} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CpvPageHeader
        title={product.productName}
        description={`${product.cpvProductId} · ${product.productCode}`}
        trail={[
          { label: 'Continued Process Verification', href: '/cpv/dashboard' },
          { label: 'Product Master', href: '/cpv/product-master' },
          { label: product.productName },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push('/cpv/product-master')}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Button>
            {canManage && (
              <Button size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
                <Pencil className="h-4 w-4" />Edit
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <StatusBadge status={product.cpvStatus} />
        <span className="text-sm text-muted-foreground">
          Review: {product.cpvReviewFrequency} · Due: {product.nextReviewDueDate || '—'}
        </span>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cpp">Linked CPP Parameters</TabsTrigger>
          <TabsTrigger value="cqa">Linked CQA Parameters</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="reviews">CPV Reviews</TabsTrigger>
          <TabsTrigger value="trend">Trend Summary</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Product Overview</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {[
                ['Generic Name', product.genericName],
                ['Brand Name', product.brandName],
                ['Strength', product.strength],
                ['Dosage Form', product.dosageForm],
                ['Route', product.routeOfAdministration],
                ['Pack Size', product.packSize],
                ['Market', product.market],
                ['Shelf Life', product.shelfLife],
                ['Storage', product.storageCondition],
                ['Batch Size', product.standardBatchSize],
                ['Mfg License', product.manufacturingLicenseNumber],
                ['MFR', product.mfrNumber],
                ['BMR', product.bmrNumber],
                ['BPR', product.bprNumber],
                ['Specification', product.specificationNumber],
                ['STP', product.stpNumber],
                ['CPV Start', product.cpvStartDate],
                ['CPV Owner', product.cpvOwner],
                ['QA Reviewer', product.qaReviewer],
                ['Remarks', product.remarks],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-0.5">{val || '—'}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cpp" className="mt-4 space-y-3">
          {canManage && (
            <Button size="sm" className="gap-2" onClick={() => void openLinkDialog('CPP')}>
              <Link2 className="h-4 w-4" />Link CPP Parameter
            </Button>
          )}
          <ParameterTable
            rows={cppParams}
            canEdit={canManage}
            onUnlink={(pid) => void handleUnlink(pid, 'CPP')}
          />
        </TabsContent>

        <TabsContent value="cqa" className="mt-4 space-y-3">
          {canManage && (
            <Button size="sm" className="gap-2" onClick={() => void openLinkDialog('CQA')}>
              <Link2 className="h-4 w-4" />Link CQA Parameter
            </Button>
          )}
          <ParameterTable
            rows={cqaParams}
            canEdit={canManage}
            onUnlink={(pid) => void handleUnlink(pid, 'CQA')}
          />
        </TabsContent>

        <TabsContent value="batches" className="mt-4">
          {batches.length === 0 ? (
            <EmptyState title="No batches" message="No batch records linked to this product." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Batch No', 'Mfg Date', 'Status', 'Market'].map((h) => <TableHead key={h}>{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b, i) => (
                    <TableRow key={String(b.id || i)}>
                      <TableCell>{String(b.batchNumber || b.batch_number || b.batchNo || '—')}</TableCell>
                      <TableCell>{String(b.manufacturingDate || b.manufacturing_date || '—')}</TableCell>
                      <TableCell><StatusBadge status={String(b.status || '—')} /></TableCell>
                      <TableCell>{String(b.market || '—')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          {reviews.length === 0 ? (
            <EmptyState title="No CPV reviews" message="No annual or periodic CPV reviews found." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Review No', 'Period', 'Status', 'Due Date'].map((h) => <TableHead key={h}>{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((r, i) => (
                    <TableRow key={String(r.id || i)}>
                      <TableCell>{String(r.reviewNo || r.review_no || r.id || '—')}</TableCell>
                      <TableCell>{String(r.reviewPeriod || r.review_period || r.period || '—')}</TableCell>
                      <TableCell><StatusBadge status={String(r.status || '—')} /></TableCell>
                      <TableCell>{String(r.dueDate || r.due_date || '—')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trend" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="CPP Parameters (collection)" value={trendCpp} tone="blue" />
            <KpiCard label="CQA Parameters (collection)" value={trendCqa} tone="green" />
            <KpiCard label="Linked CPP" value={cppParams.length} tone="blue" />
            <KpiCard label="Linked CQA" value={cqaParams.length} tone="green" />
            <KpiCard label="Batches" value={batches.length} tone="amber" />
            <KpiCard label="CPV Reviews" value={reviews.length} tone="amber" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Full trend analysis available in{' '}
            <a href="/cpv/trend-analysis" className="text-blue-600 hover:underline">Trend Analysis</a>
            {' '}and{' '}
            <a href="/cpv/process-capability" className="text-blue-600 hover:underline">Process Capability</a>.
          </p>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {auditTrail.length === 0 ? (
            <EmptyState title="No audit events" message="Audit trail entries will appear after create/update actions." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Timestamp', 'Action', 'User', 'Details'].map((h) => <TableHead key={h}>{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditTrail.map((a, i) => (
                    <TableRow key={String(a.id || i)}>
                      <TableCell className="text-xs">{String(a.timestamp || a.dateTime || a.createdAt || '—')}</TableCell>
                      <TableCell>{String(a.actionType || a.action || '—')}</TableCell>
                      <TableCell>{String(a.changedByUserName || a.userName || a.userId || '—')}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {String(a.actionDescription || a.newValue || '—')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CpvProductFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={product}
        adminProducts={adminProducts}
        onSubmit={handleSave}
        submitting={submitting}
      />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link {linkType} Parameter</DialogTitle>
          </DialogHeader>
          <Select value={linkParamId} onValueChange={setLinkParamId}>
            <SelectTrigger><SelectValue placeholder="Select parameter" /></SelectTrigger>
            <SelectContent>
              {availableParams.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.parameterCode} — {p.parameterName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleLink()} disabled={submitting || !linkParamId}>Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
