import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { TMS_COLLECTIONS } from '@/lib/training-types';
import { listCompetency, getAssignmentById, listTrainingRecords } from '@/lib/training-service';
import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import { downloadCsv } from '@/lib/export-utils';
import { autoCreateRetraining } from '@/lib/training-retraining-service';
import {
  TRAINING_EFFECTIVENESS_MODULE, EFFECTIVENESS_COLLECTION,
  generateEvaluationNumber, computeEvaluationResult, computeCompetencyFromScore,
  type TrainingEvaluationRecord, type EffectivenessFilters, type EffectivenessActor,
  type EffectivenessDashboardData,
} from '@/lib/training-effectiveness-types';
import type { CreateEvaluationInput, ApproveEvaluationInput } from '@/lib/training-effectiveness-schemas';
import { createEvaluationSchema } from '@/lib/training-effectiveness-schemas';
import {
  filterEvaluationsByRole, applyEffectivenessFilters, computeEffectivenessDashboard,
} from '@/lib/training-effectiveness-records';

export type {
  TrainingEvaluationRecord, EffectivenessFilters, EffectivenessActor, EffectivenessDashboardData,
};

function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function db() { return getFirebaseFirestore(); }

export function mapEvaluation(id: string, data: Record<string, unknown>): TrainingEvaluationRecord {
  const obtained = data.obtained_score != null ? Number(data.obtained_score)
    : data.assessment_score != null ? Number(data.assessment_score) : null;
  const passing = Number(data.passing_score ?? 80);
  const result = String(data.result || (obtained != null ? computeEvaluationResult(obtained, passing) : ''));
  return {
    id,
    evaluation_id: String(data.evaluation_id || id),
    evaluation_number: String(data.evaluation_number || `TEVAL-${id.slice(0, 8)}`),
    employee_id: String(data.employee_id || ''),
    employee_name: String(data.employee_name || ''),
    department: String(data.department || ''),
    designation: String(data.designation || ''),
    training_record_id: String(data.training_record_id || data.assignment_id || ''),
    assignment_id: String(data.assignment_id || ''),
    training_number: String(data.training_number || ''),
    training_topic: String(data.training_topic || ''),
    document_number: String(data.document_number || ''),
    sop_version: String(data.sop_version || ''),
    evaluation_type: String(data.evaluation_type || 'Written Test'),
    evaluator: String(data.evaluator || data.evaluated_by_name || ''),
    evaluator_id: String(data.evaluator_id || data.evaluated_by || ''),
    evaluation_date: String(data.evaluation_date || data.evaluated_at?.toString().slice(0, 10) || ''),
    method: String(data.method || 'Assessment'),
    passing_score: passing,
    obtained_score: obtained,
    result,
    competency_level: String(data.competency_level || (obtained != null ? computeCompetencyFromScore(obtained, passing) : '')),
    observation: String(data.observation || data.practical_observation || ''),
    corrective_action_required: Boolean(data.corrective_action_required ?? result === 'Fail'),
    corrective_action: String(data.corrective_action || ''),
    reassessment_required: Boolean(data.reassessment_required ?? result === 'Fail'),
    reassessment_date: data.reassessment_date ? String(data.reassessment_date) : null,
    status: String(data.status || (data.effectiveness_result ? 'Approved' : 'Submitted')),
    attachment_url: data.attachment_url ? String(data.attachment_url) : null,
    digital_signature: data.digital_signature ? String(data.digital_signature) : null,
    remarks: String(data.remarks || ''),
    practical_observation: String(data.practical_observation || ''),
    supervisor_feedback: String(data.supervisor_feedback || ''),
    effectiveness_result: String(data.effectiveness_result || (result === 'Pass' ? 'Effective' : 'Not Effective')),
    created_at: String(data.created_at || data.evaluated_at || ''),
    updated_at: String(data.updated_at || data.evaluated_at || ''),
    created_by: String(data.created_by || data.evaluated_by || ''),
    created_by_name: String(data.created_by_name || data.evaluated_by_name || ''),
    updated_by: String(data.updated_by || ''),
    updated_by_name: String(data.updated_by_name || ''),
  };
}

async function audit(actor: EffectivenessActor, action: string, recordId: string, detail?: unknown) {
  await logTrainingAuditRecord(
    actor, action, recordId, EFFECTIVENESS_COLLECTION, null, detail,
    { moduleName: TRAINING_EFFECTIVENESS_MODULE },
  );
}

async function notify(title: string, message: string, recordId: string, roles: string[], userId?: string) {
  if (userId) {
    try {
      await addDoc(collection(db(), TMS_COLLECTIONS.notifications), {
        title, message, module: TRAINING_EFFECTIVENESS_MODULE, record_id: recordId,
        target_user_id: userId, read: false, created_at: now(),
      });
    } catch { /* optional */ }
  }
  for (const role of roles) {
    try {
      await addDoc(collection(db(), TMS_COLLECTIONS.notifications), {
        title, message, module: TRAINING_EFFECTIVENESS_MODULE, record_id: recordId,
        target_role: role, read: false, created_at: now(),
      });
    } catch { /* optional */ }
  }
}

export async function listEvaluations(max = 500): Promise<TrainingEvaluationRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(db(), EFFECTIVENESS_COLLECTION),
      orderBy('created_at', 'desc'),
      limit(max),
    ));
    return snap.docs.map((d) => mapEvaluation(d.id, d.data()));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(db(), EFFECTIVENESS_COLLECTION),
        orderBy('evaluated_at', 'desc'),
        limit(max),
      ));
      return snap.docs.map((d) => mapEvaluation(d.id, d.data()));
    } catch {
      const snap = await getDocs(query(collection(db(), EFFECTIVENESS_COLLECTION), limit(max)));
      return snap.docs.map((d) => mapEvaluation(d.id, d.data()))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  }
}

export async function fetchEffectivenessDashboard(input: {
  role?: string | null;
  userId?: string;
  userDepartment?: string;
  filters?: EffectivenessFilters;
}): Promise<EffectivenessDashboardData> {
  const [evaluations, competency] = await Promise.all([
    listEvaluations(),
    listCompetency(),
  ]);
  let scoped = filterEvaluationsByRole(evaluations, input.role, input.userId, input.userDepartment);
  scoped = applyEffectivenessFilters(scoped, input.filters || {});
  return computeEffectivenessDashboard(scoped, competency);
}

export async function createEvaluation(
  input: CreateEvaluationInput,
  actor: EffectivenessActor,
): Promise<TrainingEvaluationRecord> {
  const parsed = createEvaluationSchema.parse(input);
  const result = computeEvaluationResult(parsed.obtained_score, parsed.passing_score);
  const competencyLevel = computeCompetencyFromScore(parsed.obtained_score, parsed.passing_score);
  const evalNumber = generateEvaluationNumber();
  const timestamp = now();

  let trainingNumber = '';
  let assignmentId = parsed.assignment_id;
  if (parsed.assignment_id) {
    const asn = await getAssignmentById(parsed.assignment_id);
    if (asn) trainingNumber = asn.training_number;
  }

  const payload = {
    evaluation_id: '',
    evaluation_number: evalNumber,
    employee_id: parsed.employee_id,
    employee_name: parsed.employee_name,
    department: parsed.department,
    designation: parsed.designation,
    training_record_id: parsed.training_record_id,
    assignment_id: assignmentId,
    training_number: trainingNumber,
    training_topic: parsed.training_topic,
    document_number: parsed.document_number,
    sop_version: parsed.sop_version,
    evaluation_type: parsed.evaluation_type,
    evaluator: parsed.evaluator,
    evaluator_id: actor.id,
    evaluation_date: parsed.evaluation_date,
    method: parsed.method,
    passing_score: parsed.passing_score,
    obtained_score: parsed.obtained_score,
    assessment_score: parsed.obtained_score,
    result,
    competency_level: competencyLevel,
    observation: parsed.observation,
    practical_observation: parsed.practical_observation,
    supervisor_feedback: parsed.supervisor_feedback,
    effectiveness_result: result === 'Pass' ? 'Effective' : 'Not Effective',
    corrective_action_required: result === 'Fail',
    corrective_action: parsed.corrective_action,
    reassessment_required: parsed.reassessment_required || result === 'Fail',
    reassessment_date: parsed.reassessment_date || (result === 'Fail'
      ? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) : null),
    status: 'Submitted',
    attachment_url: null,
    digital_signature: null,
    remarks: parsed.remarks,
    evaluated_by: actor.id,
    evaluated_by_name: actor.name,
    evaluated_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  const ref = await addDoc(collection(db(), EFFECTIVENESS_COLLECTION), payload);
  await updateDoc(ref, { evaluation_id: ref.id });

  await audit(actor, 'Evaluation Created', ref.id, { evaluation_number: evalNumber, result });
  await notify('Training Evaluation Submitted', `${parsed.employee_name}: ${parsed.training_topic} — ${result}`,
    ref.id, ['qa_manager', 'training_coordinator'], parsed.employee_id);

  if (result === 'Fail') {
    await audit(actor, 'CAPA Recommendation', ref.id, { reason: 'Failed competency evaluation' });
    await notify('CAPA Recommendation', `Failed evaluation for ${parsed.employee_name} — CAPA review recommended`,
      ref.id, ['qa_manager', 'head_qa']);
    try {
      await autoCreateRetraining({
        employee_id: parsed.employee_id,
        employee_name: parsed.employee_name,
        department: parsed.department,
        designation: parsed.designation,
        training_topic: parsed.training_topic,
        original_training_id: parsed.training_record_id,
        trigger_type: 'Failed Competency',
        reason: `Failed effectiveness evaluation — score ${parsed.obtained_score}/${parsed.passing_score}`,
        trainer: parsed.evaluator,
      }, actor);
    } catch { /* optional */ }
  }

  if (competencyLevel === 'Needs Improvement') {
    await notify('Competency Needs Improvement', `${parsed.employee_name} needs competency improvement for ${parsed.training_topic}`,
      ref.id, ['department_head']);
  }

  if (payload.reassessment_required && payload.reassessment_date) {
    await audit(actor, 'Reassessment Scheduled', ref.id, { date: payload.reassessment_date });
    await notify('Reassessment Scheduled', `Reassessment due ${payload.reassessment_date} for ${parsed.employee_name}`,
      ref.id, ['training_coordinator'], parsed.employee_id);
  }

  return mapEvaluation(ref.id, { ...payload, evaluation_id: ref.id });
}

export async function approveEvaluation(
  input: ApproveEvaluationInput,
  actor: EffectivenessActor,
): Promise<TrainingEvaluationRecord | null> {
  const snap = await getDoc(doc(db(), EFFECTIVENESS_COLLECTION, input.evaluation_id));
  if (!snap.exists()) return null;
  const status = input.action === 'approve' ? 'Approved' : 'Rejected';
  const updates = {
    status,
    remarks: input.remarks,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
    digital_signature: input.action === 'approve' ? `eSign:${actor.name}:${now()}` : null,
  };
  await updateDoc(snap.ref, updates);
  await audit(actor, input.action === 'approve' ? 'Evaluation Approved' : 'Evaluation Rejected',
    input.evaluation_id, updates);
  return mapEvaluation(snap.id, { ...snap.data(), ...updates });
}

export async function closeEvaluation(id: string, actor: EffectivenessActor): Promise<void> {
  await updateDoc(doc(db(), EFFECTIVENESS_COLLECTION, id), {
    status: 'Closed', updated_at: now(), updated_by: actor.id, updated_by_name: actor.name,
  });
  await audit(actor, 'Evaluation Closed', id);
}

export function exportEvaluationsCsv(records: TrainingEvaluationRecord[]) {
  const headers = [
    'Evaluation #', 'Employee', 'Department', 'Topic', 'Type', 'Evaluator', 'Date',
    'Score', 'Pass Score', 'Result', 'Competency', 'Status',
  ];
  const rows = records.map((r) => [
    r.evaluation_number, r.employee_name, r.department, r.training_topic, r.evaluation_type,
    r.evaluator, r.evaluation_date, r.obtained_score ?? '—', r.passing_score,
    r.result, r.competency_level, r.status,
  ]);
  downloadCsv(`training-effectiveness-${today()}.csv`, headers, rows);
}

export function openEvaluationPrint(records: TrainingEvaluationRecord[]) {
  const rows = records.map((r) => `
    <tr><td>${r.evaluation_number}</td><td>${r.employee_name}</td><td>${r.training_topic}</td>
    <td>${r.obtained_score ?? '—'}</td><td>${r.result}</td><td>${r.competency_level}</td><td>${r.status}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><head><title>Training Effectiveness Report</title>
<style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;font-size:11px}
th,td{border:1px solid #ccc;padding:6px}th{background:#2563eb;color:#fff}</style></head>
<body><h1>Training Effectiveness & Competency Evaluation</h1><p>Generated: ${now()}</p>
<table><thead><tr><th>#</th><th>Employee</th><th>Topic</th><th>Score</th><th>Result</th><th>Competency</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody></table>
<p><em>EU GMP Annex 11 | 21 CFR Part 11 | GAMP 5 Compliant</em></p></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export async function logEffectivenessExport(actor: EffectivenessActor, count: number) {
  await audit(actor, 'Export', 'effectiveness-export', { count });
}
