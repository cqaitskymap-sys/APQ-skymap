import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import {
  listMatrixDefinitions, createMatrixDefinition, updateMatrixDefinition,
  assignFromMatrixDefinitions, processRefresherAssignments,
  exportMatrixDefinitionsCsv, exportMatrixCsv, buildTrainingMatrix,
  syncDmsTrainingLinks, assignTrainingForNewUser,
} from '@/lib/training-service';
import type { TmsActor } from '@/lib/training-types';
import {
  TRAINING_MATRIX_MODULE, MATRIX_COLLECTION,
  type MatrixFilters, type MatrixActor, type MatrixDashboardData,
  type TrainingMatrixDefinition, type TrainingMatrixRow,
} from '@/lib/training-matrix-types';
import type { CreateMatrixInput } from '@/lib/training-matrix-schemas';
import {
  filterDefinitionsByRole, filterComplianceByRole,
  applyMatrixFilters, computeMatrixDashboard,
} from '@/lib/training-matrix-records';

export type { MatrixFilters, MatrixActor, MatrixDashboardData, TrainingMatrixDefinition, TrainingMatrixRow };

function toTmsActor(actor: MatrixActor): TmsActor {
  return { id: actor.id, name: actor.name, role: actor.role || '' };
}

async function audit(actor: MatrixActor, action: string, recordId: string, detail?: unknown) {
  await logTrainingAuditRecord(
    actor, action, recordId, MATRIX_COLLECTION, null, detail,
    { moduleName: TRAINING_MATRIX_MODULE },
  );
}

export async function fetchMatrixDashboard(input: {
  role?: string | null;
  userDepartment?: string;
  filters?: MatrixFilters;
}): Promise<MatrixDashboardData> {
  const [definitions, compliance] = await Promise.all([
    listMatrixDefinitions(),
    buildTrainingMatrix(),
  ]);

  let scopedDefs = filterDefinitionsByRole(definitions, input.role, input.userDepartment);
  let scopedComp = filterComplianceByRole(compliance, input.role, input.userDepartment);
  scopedDefs = applyMatrixFilters(scopedDefs, input.filters || {});

  return computeMatrixDashboard(scopedDefs, scopedComp);
}

export async function createMatrix(
  input: CreateMatrixInput,
  actor: MatrixActor,
): Promise<TrainingMatrixDefinition> {
  const result = await createMatrixDefinition(input, toTmsActor(actor));
  await audit(actor, 'Matrix Created', result.id, { code: result.matrix_code, topic: result.training_topic });
  return result;
}

export async function updateMatrix(
  id: string,
  input: Partial<CreateMatrixInput>,
  actor: MatrixActor,
): Promise<TrainingMatrixDefinition> {
  const result = await updateMatrixDefinition(id, input, toTmsActor(actor));
  await audit(actor, 'Matrix Updated', id, input);
  return result;
}

export async function autoAssignFromMatrix(actor: MatrixActor): Promise<number> {
  const count = await assignFromMatrixDefinitions(toTmsActor(actor));
  await audit(actor, 'Matrix Auto-Assign', 'matrix-auto', { count });
  return count;
}

export async function processMatrixRefreshers(actor: MatrixActor): Promise<number> {
  const count = await processRefresherAssignments(toTmsActor(actor));
  await audit(actor, 'Matrix Refresher Process', 'matrix-refresher', { count });
  return count;
}

export async function syncSopMatrixRetraining(actor: MatrixActor): Promise<number> {
  const count = await syncDmsTrainingLinks(toTmsActor(actor));
  await audit(actor, 'SOP Revision Retraining', 'dms-sync', { count });
  return count;
}

export async function assignNewUserFromMatrix(employeeId: string, actor: MatrixActor): Promise<number> {
  const count = await assignTrainingForNewUser(employeeId, toTmsActor(actor));
  await audit(actor, 'New User Matrix Assign', employeeId, { count });
  return count;
}

export function exportMatrixDefinitions(definitions: TrainingMatrixDefinition[]) {
  exportMatrixDefinitionsCsv(definitions);
}

export function exportMatrixCompliance(compliance: TrainingMatrixRow[]) {
  exportMatrixCsv(compliance);
}

export function openMatrixPrint(definitions: TrainingMatrixDefinition[]) {
  const rows = definitions.map((m) => `
    <tr><td>${m.matrix_code}</td><td>${m.department}</td><td>${m.designation}</td>
    <td>${m.training_topic}</td><td>${m.training_type}</td><td>${m.document_number || '—'}</td>
    <td>${m.sop_number || '—'}</td><td>${m.training_frequency}</td><td>${m.status}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><head><title>Training Matrix</title>
<style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;font-size:11px}
th,td{border:1px solid #ccc;padding:6px}th{background:#2563eb;color:#fff}</style></head>
<body><h1>Training Matrix Management Report</h1><p>Generated: ${new Date().toISOString()}</p>
<table><thead><tr><th>Code</th><th>Dept</th><th>Designation</th><th>Topic</th><th>Type</th><th>Doc #</th><th>SOP</th><th>Frequency</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export async function logMatrixExport(actor: MatrixActor, count: number, type: string) {
  await audit(actor, 'Export', `matrix-${type}`, { count });
}
