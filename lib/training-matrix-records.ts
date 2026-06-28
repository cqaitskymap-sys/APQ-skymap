import { normalizeRole } from '@/lib/permissions';
import type { TrainingMatrixDefinition, TrainingMatrixRow } from '@/lib/training-types';
import {
  type MatrixFilters, type MatrixDashboardData,
  canManageMatrixModule, canEditMatrixModule, canViewMatrixModule,
  isDepartmentMatrixView,
} from './training-matrix-types';

export function filterDefinitionsByRole(
  definitions: TrainingMatrixDefinition[],
  role?: string | null,
  userDepartment?: string,
): TrainingMatrixDefinition[] {
  const r = normalizeRole(role || '');
  if (canManageMatrixModule(r) || canEditMatrixModule(r) || ['auditor', 'viewer'].includes(r)) {
    return definitions;
  }
  if (isDepartmentMatrixView(r) && userDepartment) {
    return definitions.filter((d) => d.department?.toLowerCase() === userDepartment.toLowerCase());
  }
  return definitions;
}

export function filterComplianceByRole(
  compliance: TrainingMatrixRow[],
  role?: string | null,
  userDepartment?: string,
): TrainingMatrixRow[] {
  const r = normalizeRole(role || '');
  if (canManageMatrixModule(r) || canEditMatrixModule(r) || ['auditor', 'viewer'].includes(r)) {
    return compliance;
  }
  if (isDepartmentMatrixView(r) && userDepartment) {
    return compliance.filter((c) => c.department?.toLowerCase() === userDepartment.toLowerCase());
  }
  return compliance;
}

export function applyMatrixFilters(
  definitions: TrainingMatrixDefinition[],
  filters: MatrixFilters,
): TrainingMatrixDefinition[] {
  const q = filters.search?.toLowerCase() || '';
  return definitions.filter((d) => {
    const matchSearch = !q
      || d.matrix_code.toLowerCase().includes(q)
      || d.training_topic.toLowerCase().includes(q)
      || d.document_number.toLowerCase().includes(q)
      || d.sop_number.toLowerCase().includes(q);
    const matchDept = !filters.department || d.department === filters.department;
    const matchDesig = !filters.designation || d.designation === filters.designation;
    const matchRole = !filters.role || d.role === filters.role;
    const matchType = !filters.training_type || d.training_type === filters.training_type;
    const matchFreq = !filters.training_frequency || d.training_frequency === filters.training_frequency;
    const matchStatus = !filters.status || d.status === filters.status;
    const matchDoc = !filters.document_number || d.document_number === filters.document_number;
    const matchSop = !filters.sop_number || d.sop_number === filters.sop_number;
    return matchSearch && matchDept && matchDesig && matchRole && matchType
      && matchFreq && matchStatus && matchDoc && matchSop;
  });
}

export function groupDefinitions(
  definitions: TrainingMatrixDefinition[],
  mode: 'department' | 'designation' | 'sop',
): Record<string, TrainingMatrixDefinition[]> {
  const map: Record<string, TrainingMatrixDefinition[]> = {};
  for (const d of definitions) {
    let key: string;
    if (mode === 'department') key = d.department;
    else if (mode === 'designation') key = `${d.department} / ${d.designation}`;
    else key = d.sop_number || d.document_number || 'No Document';
    if (!map[key]) map[key] = [];
    map[key].push(d);
  }
  return map;
}

export function computeMatrixDashboard(
  definitions: TrainingMatrixDefinition[],
  compliance: TrainingMatrixRow[],
): MatrixDashboardData {
  const active = definitions.filter((d) => d.status === 'Active');
  const deptSet = new Set(definitions.map((d) => d.department));
  const sopSet = new Set(definitions.filter((d) => d.sop_number || d.document_number).map((d) => d.sop_number || d.document_number));

  const deptMap: Record<string, number> = {};
  const freqMap: Record<string, number> = {};
  const typeMap: Record<string, number> = {};
  const compDept: Record<string, { total: number; sum: number }> = {};

  definitions.forEach((d) => {
    deptMap[d.department] = (deptMap[d.department] || 0) + 1;
    freqMap[String(d.training_frequency)] = (freqMap[String(d.training_frequency)] || 0) + 1;
    typeMap[d.training_type] = (typeMap[d.training_type] || 0) + 1;
  });

  compliance.forEach((c) => {
    if (!compDept[c.department]) compDept[c.department] = { total: 0, sum: 0 };
    compDept[c.department].total++;
    compDept[c.department].sum += c.compliance_percent;
  });

  const avgCompliance = compliance.length > 0
    ? Math.round(compliance.reduce((s, c) => s + c.compliance_percent, 0) / compliance.length)
    : 100;

  return {
    kpis: {
      totalMatrix: definitions.length,
      activeMatrix: active.length,
      inactiveMatrix: definitions.length - active.length,
      departmentsCovered: deptSet.size,
      sopMapped: sopSet.size,
      effectivenessRequired: definitions.filter((d) => d.effectiveness_required).length,
      avgCompliance,
      employeesTracked: compliance.length,
    },
    charts: {
      departmentMatrix: Object.entries(deptMap).map(([name, value]) => ({ name, value })),
      frequencyDistribution: Object.entries(freqMap).map(([name, value]) => ({ name, value })),
      trainingTypeDistribution: Object.entries(typeMap).map(([name, value]) => ({ name, value })),
      complianceByDepartment: Object.entries(compDept).map(([name, v]) => ({
        name, value: v.total > 0 ? Math.round(v.sum / v.total) : 0,
      })),
    },
    definitions,
    compliance,
  };
}
