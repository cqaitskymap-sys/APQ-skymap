import { normalizeRole } from '@/lib/permissions';
import { calcRecoveryPercent } from '@/lib/recall-types';
import type { RecallCreateInput } from '@/lib/recall-schemas';

export const RECALL_CREATE_MODULE = 'Recall Create';

export const RECALL_WIZARD_STEPS = [
  'Recall Initiation',
  'Product & Batch',
  'Reason & Risk',
  'Distribution & Recovery',
  'Regulatory & CAPA',
  'Review & Submit',
] as const;

export type RecallCreateActor = { id: string; name: string; role?: string; department?: string };

export interface RecallProductOption {
  id: string;
  name: string;
  code?: string;
}

export interface RecallBatchOption {
  id: string;
  batch_number: string;
  product_name?: string;
  mfg_date?: string;
  exp_date?: string;
  pqr_id?: string | null;
}

export interface RecallSourceOption {
  id: string;
  number: string;
  label: string;
  product_name?: string;
  batch_number?: string;
  market_region?: string;
  reason?: string;
}

export interface RecallCapaOption {
  id: string;
  capa_number: string;
  title?: string;
}

export interface RecallOwnerOption {
  id: string;
  name: string;
  department?: string;
}

export interface RecallAutoRules {
  notify_head_qa: boolean;
  notify_regulatory: boolean;
  create_regulatory_task: boolean;
  allow_capa_link: boolean;
  include_pqr_review: boolean;
}

export function buildRecallNumberFallback(year: number, seq: number): string {
  return `REC/${year}/${String(seq).padStart(4, '0')}`;
}

export function canCreateRecallWizard(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (isRecallCreateReadOnly(r)) return false;
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function isRecallCreateReadOnly(role?: string | null): boolean {
  return normalizeRole(role || '') === 'auditor';
}

export function canEditRecallRegulatorySection(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs'].includes(normalizeRole(role || ''));
}

export function canEditRecallDistributionSection(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'warehouse', 'warehouse_manager'].includes(normalizeRole(role || ''));
}

export function computeRecallAutoRules(input: Partial<RecallCreateInput>): RecallAutoRules {
  return {
    notify_head_qa: input.recall_classification === 'Class I',
    notify_regulatory: input.recall_classification === 'Class I' || input.regulatory_notification_required === true,
    create_regulatory_task: input.regulatory_notification_required === true,
    allow_capa_link: input.capa_required === true,
    include_pqr_review: input.include_in_pqr_review !== false,
  };
}

export function computeRecoveryPreview(distributed: number, recovered: number): number {
  return calcRecoveryPercent(distributed, recovered);
}

export function mapProductToForm(product: RecallProductOption) {
  return { product_name: product.name, product_code: product.code || '' };
}

export function mapBatchToForm(batch: RecallBatchOption) {
  return {
    batch_number: batch.batch_number,
    product_name: batch.product_name || '',
    mfg_date: batch.mfg_date || '',
    exp_date: batch.exp_date || '',
  };
}

export function mapSourceToForm(source: RecallSourceOption) {
  return {
    source_reference_id: source.id,
    source_reference_number: source.number,
    product_name: source.product_name || '',
    batch_number: source.batch_number || '',
    market_region: source.market_region || '',
    reason_for_recall: source.reason || '',
  };
}

export function defaultNotificationDueDate(recallDate: string): string {
  const d = new Date(recallDate || new Date().toISOString().split('T')[0]);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

export function defaultRecallDueDate(recallDate: string): string {
  const d = new Date(recallDate || new Date().toISOString().split('T')[0]);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}
