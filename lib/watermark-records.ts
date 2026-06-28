import type {
  WatermarkTemplateRecord, WatermarkRuleRecord, WatermarkHistoryRecord,
  DocumentWatermarkRecord, WatermarkKpis, WatermarkCharts, WatermarkFilters,
} from './watermark-types';

function monthKey(d: string) { return d.slice(0, 7); }
function todayKey() { return new Date().toISOString().split('T')[0]; }

export function mapTemplateRaw(raw: Record<string, unknown> & { id: string }): WatermarkTemplateRecord {
  return {
    id: raw.id,
    watermark_id: (raw.watermark_id as string) || raw.id,
    template_name: (raw.template_name as string) || '',
    watermark_type: (raw.watermark_type as string) || 'Custom',
    display_text: (raw.display_text as string) || '',
    description: (raw.description as string) || '',
    document_status: (raw.document_status as string) || '',
    applies_to: (raw.applies_to as string) || 'All Documents',
    trigger_event: (raw.trigger_event as string) || 'Print',
    visibility: (raw.visibility as string) || 'Visible',
    position: (raw.position as string) || 'Diagonal',
    rotation: (raw.rotation as number) ?? -45,
    opacity: (raw.opacity as number) ?? 0.25,
    font_family: (raw.font_family as string) || 'Arial',
    font_size: (raw.font_size as number) ?? 48,
    color: (raw.color as string) || '#CC0000',
    repeat_pattern: (raw.repeat_pattern as string) || 'Single',
    background_image: (raw.background_image as string) || '',
    qr_code_enabled: Boolean(raw.qr_code_enabled),
    barcode_enabled: Boolean(raw.barcode_enabled),
    include_document_number: Boolean(raw.include_document_number),
    include_version: Boolean(raw.include_version),
    include_copy_number: Boolean(raw.include_copy_number),
    include_print_date: Boolean(raw.include_print_date),
    include_user_name: Boolean(raw.include_user_name),
    include_department: Boolean(raw.include_department),
    include_timestamp: Boolean(raw.include_timestamp),
    include_confidentiality_level: Boolean(raw.include_confidentiality_level),
    include_digital_fingerprint: Boolean(raw.include_digital_fingerprint),
    status: (raw.status as string) || 'Active',
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function mapRuleRaw(raw: Record<string, unknown> & { id: string }): WatermarkRuleRecord {
  return {
    id: raw.id,
    rule_id: (raw.rule_id as string) || raw.id,
    rule_name: (raw.rule_name as string) || '',
    template_id: (raw.template_id as string) || '',
    template_name: (raw.template_name as string) || '',
    document_status: (raw.document_status as string) || '',
    document_type: (raw.document_type as string) || 'All',
    trigger_event: (raw.trigger_event as string) || 'Print',
    watermark_type: (raw.watermark_type as string) || 'Custom',
    priority: (raw.priority as number) ?? 100,
    status: (raw.status as string) || 'Pending Approval',
    approved_by: (raw.approved_by as string) || '',
    approved_by_name: (raw.approved_by_name as string) || '',
    approved_at: (raw.approved_at as string) || null,
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function mapHistoryRaw(raw: Record<string, unknown> & { id: string }): WatermarkHistoryRecord {
  return {
    id: raw.id,
    event_id: (raw.event_id as string) || raw.id,
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    version: (raw.version as string) || '',
    template_id: (raw.template_id as string) || '',
    template_name: (raw.template_name as string) || '',
    watermark_type: (raw.watermark_type as string) || '',
    trigger_event: (raw.trigger_event as string) || '',
    display_text: (raw.display_text as string) || '',
    rendered_text: (raw.rendered_text as string) || '',
    barcode: (raw.barcode as string) || '',
    qr_code: (raw.qr_code as string) || '',
    metadata: (raw.metadata as Record<string, string>) || {},
    department: (raw.department as string) || '',
    user_id: (raw.user_id as string) || '',
    user_name: (raw.user_name as string) || '',
    event_status: (raw.event_status as WatermarkHistoryRecord['event_status']) || 'Applied',
    failure_reason: (raw.failure_reason as string) || '',
    created_at: (raw.created_at as string) || '',
  };
}

export function mapDocumentWatermarkRaw(raw: Record<string, unknown> & { id: string }): DocumentWatermarkRecord {
  return {
    id: raw.id,
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    version: (raw.version as string) || '',
    document_status: (raw.document_status as string) || '',
    watermark_type: (raw.watermark_type as string) || '',
    template_id: (raw.template_id as string) || '',
    display_text: (raw.display_text as string) || '',
    rendered_text: (raw.rendered_text as string) || '',
    trigger_event: (raw.trigger_event as string) || '',
    copy_number: (raw.copy_number as string) || '',
    barcode: (raw.barcode as string) || '',
    qr_code: (raw.qr_code as string) || '',
    department: (raw.department as string) || '',
    applied_by: (raw.applied_by as string) || '',
    applied_by_name: (raw.applied_by_name as string) || '',
    applied_at: (raw.applied_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function emptyWatermarkKpis(): WatermarkKpis {
  return {
    watermarkTemplates: 0, documentsWatermarked: 0, controlledCopies: 0,
    uncontrolledCopies: 0, trainingCopies: 0, inspectionCopies: 0,
    archivedDocuments: 0, watermarkEventsToday: 0,
  };
}

export function emptyWatermarkCharts(): WatermarkCharts {
  return {
    usageTrend: [], documentStatusDistribution: [], watermarkTypeDistribution: [],
    departmentDistribution: [], printWatermarkTrend: [], exportWatermarkTrend: [],
  };
}

export function computeWatermarkKpis(
  templates: WatermarkTemplateRecord[],
  docWatermarks: DocumentWatermarkRecord[],
  history: WatermarkHistoryRecord[],
): WatermarkKpis {
  const today = todayKey();
  return {
    watermarkTemplates: templates.filter((t) => t.status === 'Active').length,
    documentsWatermarked: new Set(docWatermarks.map((d) => d.document_id)).size,
    controlledCopies: docWatermarks.filter((d) => d.watermark_type === 'Controlled Copy').length,
    uncontrolledCopies: docWatermarks.filter((d) => d.watermark_type === 'Uncontrolled Copy').length,
    trainingCopies: docWatermarks.filter((d) => d.watermark_type === 'For Training').length,
    inspectionCopies: docWatermarks.filter((d) => d.watermark_type === 'Inspection Copy').length,
    archivedDocuments: docWatermarks.filter((d) => d.document_status === 'Archived').length,
    watermarkEventsToday: history.filter((h) => h.created_at.startsWith(today) && h.event_status === 'Applied').length,
  };
}

export function computeWatermarkCharts(
  history: WatermarkHistoryRecord[],
  docWatermarks: DocumentWatermarkRecord[],
): WatermarkCharts {
  const usageByMonth = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const byType = new Map<string, number>();
  const byDept = new Map<string, number>();
  const printByMonth = new Map<string, number>();
  const exportByMonth = new Map<string, number>();

  for (const h of history.filter((e) => e.event_status === 'Applied')) {
    if (h.created_at) usageByMonth.set(monthKey(h.created_at), (usageByMonth.get(monthKey(h.created_at)) || 0) + 1);
    byType.set(h.watermark_type || 'Unknown', (byType.get(h.watermark_type || 'Unknown') || 0) + 1);
    byDept.set(h.department || 'Unknown', (byDept.get(h.department || 'Unknown') || 0) + 1);
    if (h.trigger_event === 'Print' && h.created_at) {
      printByMonth.set(monthKey(h.created_at), (printByMonth.get(monthKey(h.created_at)) || 0) + 1);
    }
    if (h.trigger_event.startsWith('Export') && h.created_at) {
      exportByMonth.set(monthKey(h.created_at), (exportByMonth.get(monthKey(h.created_at)) || 0) + 1);
    }
  }
  for (const d of docWatermarks) {
    byStatus.set(d.document_status || 'Unknown', (byStatus.get(d.document_status || 'Unknown') || 0) + 1);
  }

  const toSorted = (m: Map<string, number>) =>
    Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));

  return {
    usageTrend: toSorted(usageByMonth),
    documentStatusDistribution: Array.from(byStatus.entries()).map(([name, value]) => ({ name, value })),
    watermarkTypeDistribution: Array.from(byType.entries()).map(([name, value]) => ({ name, value })),
    departmentDistribution: Array.from(byDept.entries()).map(([name, value]) => ({ name, value })),
    printWatermarkTrend: toSorted(printByMonth),
    exportWatermarkTrend: toSorted(exportByMonth),
  };
}

export function filterTemplates(templates: WatermarkTemplateRecord[], filters: WatermarkFilters): WatermarkTemplateRecord[] {
  let result = [...templates];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((t) =>
      t.template_name.toLowerCase().includes(q) || t.display_text.toLowerCase().includes(q),
    );
  }
  if (filters.status) result = result.filter((t) => t.status === filters.status);
  if (filters.watermark_type) result = result.filter((t) => t.watermark_type === filters.watermark_type);
  if (filters.trigger_event) result = result.filter((t) => t.trigger_event === filters.trigger_event);
  if (filters.document_status) result = result.filter((t) => t.document_status === filters.document_status);
  if (filters.visibility) result = result.filter((t) => t.visibility === filters.visibility);
  return result;
}

export function filterHistory(history: WatermarkHistoryRecord[], filters: WatermarkFilters): WatermarkHistoryRecord[] {
  let result = [...history];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((h) =>
      h.document_number.toLowerCase().includes(q) || h.document_title.toLowerCase().includes(q),
    );
  }
  if (filters.watermark_type) result = result.filter((h) => h.watermark_type === filters.watermark_type);
  if (filters.trigger_event) result = result.filter((h) => h.trigger_event === filters.trigger_event);
  if (filters.department) result = result.filter((h) => h.department === filters.department);
  if (filters.failed) result = result.filter((h) => h.event_status === 'Failed');
  if (filters.department_only) result = result.filter((h) => h.department === filters.department_only);
  return result;
}

export function filterDocWatermarks(docs: DocumentWatermarkRecord[], filters: WatermarkFilters): DocumentWatermarkRecord[] {
  let result = [...docs];
  if (filters.controlled) result = result.filter((d) => d.watermark_type === 'Controlled Copy');
  if (filters.uncontrolled) result = result.filter((d) => d.watermark_type === 'Uncontrolled Copy');
  if (filters.training) result = result.filter((d) => d.watermark_type === 'For Training');
  if (filters.inspection) result = result.filter((d) => d.watermark_type === 'Inspection Copy');
  if (filters.archived) result = result.filter((d) => d.document_status === 'Archived');
  if (filters.department_only) result = result.filter((d) => d.department === filters.department_only);
  return result;
}

export const WM_KPI_FILTER_MAP: Record<string, WatermarkFilters> = {
  templates: {},
  watermarked: {},
  controlled: { controlled: true },
  uncontrolled: { uncontrolled: true },
  training: { training: true },
  inspection: { inspection: true },
  archived: { archived: true },
  failed: { failed: true },
  pending_rules: { pending_rules: true },
};

export function getRecentEvents(history: WatermarkHistoryRecord[]): WatermarkHistoryRecord[] {
  return [...history].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
}

export function getFailedEvents(history: WatermarkHistoryRecord[]): WatermarkHistoryRecord[] {
  return history.filter((h) => h.event_status === 'Failed');
}

export function getPendingRules(rules: WatermarkRuleRecord[]): WatermarkRuleRecord[] {
  return rules.filter((r) => r.status === 'Pending Approval');
}

export function getActiveTemplates(templates: WatermarkTemplateRecord[]): WatermarkTemplateRecord[] {
  return templates.filter((t) => t.status === 'Active');
}

export function buildRenderedText(
  template: WatermarkTemplateRecord,
  ctx: Record<string, string | undefined>,
): string {
  const parts: string[] = [template.display_text];
  if (template.include_document_number && ctx.document_number) parts.push(ctx.document_number);
  if (template.include_version && ctx.version) parts.push(`v${ctx.version}`);
  if (template.include_copy_number && ctx.copy_number) parts.push(ctx.copy_number);
  if (template.include_user_name && ctx.user_name) parts.push(ctx.user_name);
  if (template.include_department && ctx.department) parts.push(ctx.department);
  if (template.include_print_date && ctx.print_date) parts.push(ctx.print_date);
  if (template.include_timestamp) parts.push(new Date().toISOString());
  if (template.include_confidentiality_level && ctx.confidentiality_level) parts.push(ctx.confidentiality_level);
  return parts.filter(Boolean).join(' | ');
}
