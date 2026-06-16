import { normalizeRole } from '@/lib/permissions';
import { isCriticalOosTest, type OosPhase1, type OosRecord } from '@/lib/oos-types';

export type Phase1Actor = { id: string; name: string; role?: string; email?: string };

export interface Phase1FormInput {
  qc_investigator?: string;
  qc_investigator_id?: string;
  analyst_name: string;
  instrument_used: string;
  instrument_id?: string;
  instrument_calibration_status: string;
  standard_used: string;
  standard_lot_number?: string;
  reagent_used: string;
  reagent_lot_number?: string;
  glassware_verified?: boolean;
  calculation_verified: boolean;
  method_followed_correctly?: boolean;
  sample_preparation_verified?: boolean;
  data_review_completed?: boolean;
  chromatogram_attached?: boolean;
  raw_data_attached?: boolean;
  chromatogram_raw_data_reviewed?: boolean;
  analyst_interview_completed?: boolean;
  lab_error_observed?: boolean;
  assignable_cause_identified?: boolean;
  investigation_findings: string;
  root_cause_identified?: string;
  root_cause?: string;
  corrective_action?: string;
  phase1_conclusion: string;
  phase1_outcome?: string;
  analyst_interview_notes?: string;
}

export interface Phase1QaReviewInput {
  decision: 'approved' | 'rejected';
  qa_review_comments: string;
}

export interface Phase1AutoRules {
  phase2Recommended: boolean;
  deviationRecommended: boolean;
  requireRootCause: boolean;
  requireCorrection: boolean;
  warnings: string[];
}

export interface Phase1TimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

export function canViewPhase1(role?: string | null, record?: OosRecord | null): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'qa_manager', 'qa', 'qc_manager', 'qc', 'auditor', 'viewer'].includes(r)) return true;
  if (r === 'head_qa') return Boolean(record && (record.is_critical_test || isCriticalOosTest(record.test_name)));
  if (['production_manager', 'production'].includes(r)) return false;
  return false;
}

export function canEditPhase1(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'qc_manager', 'qc'].includes(r);
}

export function canReviewPhase1(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'qc_manager'].includes(r);
}

export function canApprovePhase1(role?: string | null, record?: OosRecord | null): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'qa_manager', 'qa'].includes(r)) return true;
  if (r === 'head_qa' && record && (record.is_critical_test || isCriticalOosTest(record.test_name))) return true;
  return false;
}

export function isPhase1ReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role));
}

export function isCalibrationIssue(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return /fail|expired|overdue|invalid|out of calibration/.test(s);
}

export function computePhase1AutoRules(input: Partial<Phase1FormInput>): Phase1AutoRules {
  const warnings: string[] = [];
  const outcome = input.phase1_outcome || '';
  const labError = outcome === 'Laboratory Error' || input.lab_error_observed === true;
  const phase2Recommended = outcome === 'No Laboratory Error' || outcome === 'Inconclusive';
  const deviationRecommended = isCalibrationIssue(input.instrument_calibration_status);

  if (labError) {
    warnings.push('Laboratory Error — root cause and corrective action are required.');
  }
  if (phase2Recommended) {
    warnings.push('No Laboratory Error or Inconclusive outcome — Phase-II manufacturing investigation is recommended.');
  }
  if (deviationRecommended) {
    warnings.push('Instrument calibration failed or overdue — deviation creation is recommended.');
  }
  if (input.calculation_verified === false) {
    warnings.push('Calculation verification must be completed before submission.');
  }

  return {
    phase2Recommended,
    deviationRecommended,
    requireRootCause: labError,
    requireCorrection: labError,
    warnings,
  };
}

export function phase1StatusColor(status?: string): string {
  const map: Record<string, string> = {
    'Not Started': 'bg-slate-100 text-slate-700 border-slate-200',
    'In Progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'QA Review': 'bg-purple-100 text-purple-800 border-purple-200',
    Completed: 'bg-green-100 text-green-800 border-green-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
  };
  return map[status || 'Not Started'] || map['Not Started'];
}

export function mapPhase1AuditTimeline(logs: Record<string, unknown>[]): Phase1TimelineEntry[] {
  return logs
    .filter((log) => /phase.?1|phase-i|laboratory|investigation|qa review|approve|reject/i.test(String(log.actionType || log.action || '')))
    .map((log) => ({
      action: String(log.actionType || log.action || 'Activity'),
      user: String(log.userName || log.user_name || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.actionDescription || log.reason || '').slice(0, 200),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function resolveOosStatusAfterPhase1Approval(phase1: OosPhase1): string {
  if (phase1.phase1_outcome === 'Laboratory Error') return 'qa_review';
  if (phase1.phase1_outcome === 'No Laboratory Error') return 'phase2_investigation';
  return 'phase2_investigation';
}

export function resolveOosPhaseAfterPhase1Approval(phase1: OosPhase1): OosRecord['phase'] {
  return phase1.phase1_outcome === 'Laboratory Error' ? 'phase1' : 'phase2';
}
