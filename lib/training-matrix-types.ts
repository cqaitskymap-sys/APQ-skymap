import type { TrainingMatrixDefinition, TrainingMatrixRow } from '@/lib/training-types';
import { MATRIX_FREQUENCIES, MATRIX_STATUSES } from '@/lib/training-types';

export const TRAINING_MATRIX_MODULE = 'Training Matrix Management';
export const MATRIX_COLLECTION = 'training_matrix';

export { MATRIX_FREQUENCIES, MATRIX_STATUSES };
export type { TrainingMatrixDefinition, TrainingMatrixRow };

export interface MatrixFilters {
  department?: string;
  designation?: string;
  role?: string;
  training_type?: string;
  training_frequency?: string;
  status?: string;
  document_number?: string;
  sop_number?: string;
  search?: string;
}

export interface MatrixDashboardKpis {
  totalMatrix: number;
  activeMatrix: number;
  inactiveMatrix: number;
  departmentsCovered: number;
  sopMapped: number;
  effectivenessRequired: number;
  avgCompliance: number;
  employeesTracked: number;
}

export interface MatrixDashboardCharts {
  departmentMatrix: { name: string; value: number }[];
  frequencyDistribution: { name: string; value: number }[];
  trainingTypeDistribution: { name: string; value: number }[];
  complianceByDepartment: { name: string; value: number }[];
}

export interface MatrixDashboardData {
  kpis: MatrixDashboardKpis;
  charts: MatrixDashboardCharts;
  definitions: TrainingMatrixDefinition[];
  compliance: TrainingMatrixRow[];
}

export interface MatrixActor {
  id: string;
  name: string;
  role?: string;
  department?: string;
}

export function canManageMatrixModule(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'training_coordinator'].includes(r);
}

export function canEditMatrixModule(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canManageMatrixModule(r) || ['head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r);
}

export function canViewMatrixModule(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  if (['employee', 'production', 'qc', 'warehouse'].includes(r) && !canRecommendMatrixModule(r)) {
    return false;
  }
  return canEditMatrixModule(r) || canRecommendMatrixModule(r) || ['auditor', 'viewer'].includes(r);
}

export function canRecommendMatrixModule(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r);
}

export function isMatrixReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes((role || '').toLowerCase());
}

export function isDepartmentMatrixView(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canRecommendMatrixModule(r) && !canManageMatrixModule(r) && !canEditMatrixModule(r);
}

export function matrixStatusColor(status: string): string {
  return status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600';
}
