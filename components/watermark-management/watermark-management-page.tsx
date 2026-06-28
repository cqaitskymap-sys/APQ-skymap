'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, RefreshCw, Printer, Plus, Droplets } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { DmsPageHeader } from '@/components/dms/dms-page-header';
import { useWatermarkManagement } from '@/hooks/use-watermark-management';
import { WmCharts } from '@/components/watermark-management/wm-charts';
import {
  WatermarkTemplateTable, WatermarkHistoryTable, DocumentWatermarkTable,
  RuleEngineTable, WatermarkPreview, QRCodePanel, BarcodePanel, LoadingSkeleton as WmSkeleton,
} from '@/components/watermark-management/wm-ui';
import { WatermarkTemplateBuilder } from '@/components/watermark-management/template-builder-dialog';
import {
  exportWatermarksCsv, exportWatermarksExcel, logWatermarkExported, logWatermarkDashboardViewed,
  approveWatermarkRule,
} from '@/lib/watermark-service';
import type { WatermarkKpis, WatermarkTemplateRecord, DocumentWatermarkRecord } from '@/lib/watermark-types';
import { WATERMARK_TYPES, TRIGGER_EVENTS, VISIBILITY_TYPES } from '@/lib/watermark-types';
import {
  WM_KPI_FILTER_MAP, getRecentEvents, getFailedEvents, getActiveTemplates,
} from '@/lib/watermark-records';
import { cn } from '@/lib/utils';

const KPI_ITEMS: { label: string; key: keyof WatermarkKpis; filterKey?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }[] = [
  { label: 'Watermark Templates', key: 'watermarkTemplates', filterKey: 'templates', tone: 'blue' },
  { label: 'Documents Watermarked', key: 'documentsWatermarked', filterKey: 'watermarked', tone: 'blue' },
  { label: 'Controlled Copies', key: 'controlledCopies', filterKey: 'controlled', tone: 'green' },
  { label: 'Uncontrolled Copies', key: 'uncontrolledCopies', filterKey: 'uncontrolled', tone: 'amber' },
  { label: 'Training Copies', key: 'trainingCopies', filterKey: 'training', tone: 'blue' },
  { label: 'Inspection Copies', key: 'inspectionCopies', filterKey: 'inspection', tone: 'green' },
  { label: 'Archived Documents', key: 'archivedDocuments', filterKey: 'archived', tone: 'red' },
  { label: 'Watermark Events Today', key: 'watermarkEventsToday', tone: 'amber' },
];

export function WatermarkManagementPage() {
  return (<Suspense fallback={<LoadingSkeleton rows={8} />}><WatermarkContent /></Suspense>);
}

function WatermarkContent() {
  const searchParams = useSearchParams();
  const viewedLogged = useRef(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WatermarkTemplateRecord | null>(null);
  const [detailDoc, setDetailDoc] = useState<DocumentWatermarkRecord | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const {
    templates, paginatedTemplates, rules, history, docWatermarks, metrics, charts,
    filters, setFilters, loading, refreshing, error, refresh, actor,
    page, setPage, totalPages, pagination, selectedIds, toggleSelect, toggleSelectAll,
    canExport, canManageTemplates, canApprove, isReadOnly, canView,
  } = useWatermarkManagement();

  useEffect(() => {
    if (!viewedLogged.current && !loading && actor.id) {
      viewedLogged.current = true;
      void logWatermarkDashboardViewed(actor);
    }
  }, [loading, actor.id, actor]);

  useEffect(() => {
    const kpi = searchParams.get('kpi');
    if (kpi && WM_KPI_FILTER_MAP[kpi]) {
      setActiveKpi(kpi);
      setFilters((p) => ({ ...p, ...WM_KPI_FILTER_MAP[kpi] }));
    }
  }, [searchParams, setFilters]);

  const handleExport = useCallback((format: 'csv' | 'excel' | 'print') => {
    if (!templates.length) { toast.error('No records to export'); return; }
    if (format === 'csv') exportWatermarksCsv(templates);
    else if (format === 'excel') exportWatermarksExcel(templates);
    else window.print();
    void logWatermarkExported(actor, format, templates.length);
    toast.success('Export complete');
  }, [templates, actor]);

  const handleApproveRule = async (id: string) => {
    try {
      await approveWatermarkRule(id, { signature_meaning: 'I approve this watermark rule', comments: '' }, actor);
      toast.success('Rule approved');
      refresh(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Approval failed'); }
  };

  if (!canView) return <ErrorCard message="You do not have access to watermark management." />;
  if (loading && !templates.length) return <WmSkeleton rows={8} />;
  if (error) return <ErrorCard message={error} onRetry={() => refresh()} />;

  const controlledDocs = docWatermarks.filter((d) => d.watermark_type === 'Controlled Copy');
  const trainingDocs = docWatermarks.filter((d) => d.watermark_type === 'For Training');
  const inspectionDocs = docWatermarks.filter((d) => d.watermark_type === 'Inspection Copy');

  return (
    <div className="space-y-6 animate-in fade-in print:space-y-4">
      <DmsPageHeader
        title="Watermark Management"
        description="Apply configurable visible and metadata watermarks to controlled GMP documents."
        trail={[{ label: 'Watermark Management' }]}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => refresh(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          {canManageTemplates && (
            <Button size="sm" onClick={() => setBuilderOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Template
            </Button>
          )}
          {canExport && (<>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><Download className="h-4 w-4 mr-1" /> Excel</Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('print')}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          </>)}
        </>}
      />

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input placeholder="Search templates or events..." value={filters.search || ''}
              onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }} className="max-w-xs" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.watermark_type || ''}
              onChange={(e) => { setFilters({ ...filters, watermark_type: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Types</option>
              {WATERMARK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.trigger_event || ''}
              onChange={(e) => { setFilters({ ...filters, trigger_event: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Triggers</option>
              {TRIGGER_EVENTS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.status || ''}
              onChange={(e) => { setFilters({ ...filters, status: e.target.value || undefined }); setPage(1); }}>
              <option value="">All Statuses</option>
              {['Active', 'Inactive', 'Pending Approval'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={filters.visibility || ''}
              onChange={(e) => { setFilters({ ...filters, visibility: e.target.value || undefined } as typeof filters); setPage(1); }}>
              <option value="">All Visibility</option>
              {VISIBILITY_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {KPI_ITEMS.map((item) => item.filterKey ? (
          <button key={item.key} type="button" onClick={() => {
            const active = activeKpi === item.filterKey;
            setActiveKpi(active ? null : item.filterKey!);
            setFilters(active ? {} : WM_KPI_FILTER_MAP[item.filterKey!] || {});
            setPage(1);
          }} className={cn('text-left', activeKpi === item.filterKey && 'ring-2 ring-blue-500 rounded-lg')}>
            <KpiCard label={item.label} value={metrics[item.key]} tone={item.tone} />
          </button>
        ) : (
          <KpiCard key={item.key} label={item.label} value={metrics[item.key]} tone={item.tone} />
        ))}
      </div>

      <WmCharts charts={charts} />

      {previewTemplate && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold flex items-center gap-2"><Droplets className="h-5 w-5 text-blue-500" /> {previewTemplate.template_name}</h3>
              <Button variant="ghost" size="sm" onClick={() => setPreviewTemplate(null)}>Close</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <WatermarkPreview template={previewTemplate} />
              <div className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Type:</span> {previewTemplate.watermark_type}</p>
                <p><span className="text-muted-foreground">Trigger:</span> {previewTemplate.trigger_event}</p>
                <p><span className="text-muted-foreground">Visibility:</span> {previewTemplate.visibility}</p>
                <p><span className="text-muted-foreground">Position:</span> {previewTemplate.position} · {previewTemplate.rotation}° · opacity {previewTemplate.opacity}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {detailDoc && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold">{detailDoc.document_title}</h3>
              <Button variant="ghost" size="sm" onClick={() => setDetailDoc(null)}>Close</Button>
            </div>
            <p className="text-sm text-muted-foreground">{detailDoc.rendered_text}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {detailDoc.barcode && <BarcodePanel barcode={detailDoc.barcode} />}
              {detailDoc.qr_code && <QRCodePanel qrCode={detailDoc.qr_code} />}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="events">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="events">Recent Events ({history.length})</TabsTrigger>
          <TabsTrigger value="controlled">Controlled Copies ({controlledDocs.length})</TabsTrigger>
          <TabsTrigger value="training">Training ({trainingDocs.length})</TabsTrigger>
          <TabsTrigger value="inspection">Inspection ({inspectionDocs.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="rules">Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({getFailedEvents(history).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Card><CardContent className="p-0">
            <WatermarkHistoryTable events={getRecentEvents(history).slice(0, 30)} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="controlled">
          <Card><CardContent className="p-0">
            <DocumentWatermarkTable records={controlledDocs} onDetail={setDetailDoc} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="training">
          <Card><CardContent className="p-0">
            <DocumentWatermarkTable records={trainingDocs} onDetail={setDetailDoc} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="inspection">
          <Card><CardContent className="p-0">
            <DocumentWatermarkTable records={inspectionDocs} onDetail={setDetailDoc} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card><CardContent className="p-0">
            <WatermarkTemplateTable
              templates={paginatedTemplates.length ? paginatedTemplates : getActiveTemplates(templates)}
              selectedIds={selectedIds} toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll}
              isReadOnly={isReadOnly} onPreview={setPreviewTemplate}
            />
            {totalPages > 1 && (
              <div className="flex justify-between items-center p-4 border-t text-sm">
                <span className="text-muted-foreground">Page {page} of {totalPages} ({pagination.total} templates)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card><CardContent className="p-0">
            <RuleEngineTable rules={rules} isReadOnly={isReadOnly}
              onApprove={canApprove ? handleApproveRule : undefined} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="failed">
          <Card><CardContent className="p-0">
            <WatermarkHistoryTable events={getFailedEvents(history)} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <WatermarkTemplateBuilder open={builderOpen} onOpenChange={setBuilderOpen} actor={actor} onSuccess={() => refresh(true)} />
    </div>
  );
}
