import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { fetchAuditTrailEntries } from '@/lib/admin/audit-trail-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  AUDIT_TRAIL_MODULE,
  RISK_COLLECTIONS,
  applyRiskAuditFilters,
  filterRiskAuditByRole,
  isRiskAuditEntry,
  isVisibleRiskAuditEntry,
  mapToRiskAuditEntry,
  toRiskAuditEntry,
  type RiskAuditEntry,
  type RiskAuditFilters,
  type ReportActor,
} from '@/lib/risk-audit-trail-records';
import {
  fetchRiskAssessmentById,
  fetchRiskAssessmentRecords,
} from '@/lib/cpv-risk-assessment-service';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';

export type { RiskAuditEntry, RiskAuditFilters, ReportActor };

function dedupeEntries(entries: RiskAuditEntry[]): RiskAuditEntry[] {
  const seen = new Set<string>();
  const out: RiskAuditEntry[] = [];
  for (const e of entries.sort((a, b) => b.date_time.localeCompare(a.date_time))) {
    const key = e.audit_id || `${e.date_time}-${e.action_type}-${e.changed_by}-${e.field_name}-${e.risk_assessment_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function fetchGlobalRiskTrail(riskId?: string, riskNumber?: string): Promise<RiskAuditEntry[]> {
  const globalTrail = await fetchAuditTrailEntries();
  return globalTrail
    .filter((e) => isRiskAuditEntry(e, riskId, riskNumber))
    .map((e) => toRiskAuditEntry(e, riskId || e.recordId || e.documentId, riskNumber || e.documentNumber))
    .filter(isVisibleRiskAuditEntry);
}

async function fetchDocumentIdTrail(riskId: string): Promise<RiskAuditEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_COLLECTIONS.auditTrail),
      where('documentId', '==', riskId),
      orderBy('timestamp', 'desc'),
      limit(300),
    ));
    return snap.docs
      .map((d) => mapToRiskAuditEntry({ id: d.id, ...d.data() }, riskId))
      .filter(isVisibleRiskAuditEntry);
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), RISK_COLLECTIONS.auditTrail),
        where('documentId', '==', riskId),
        limit(300),
      ));
      return snap.docs
        .map((d) => mapToRiskAuditEntry({ id: d.id, ...d.data() }, riskId))
        .filter(isVisibleRiskAuditEntry);
    } catch {
      return [];
    }
  }
}

async function fetchRecordIdTrail(riskId: string): Promise<RiskAuditEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_COLLECTIONS.auditTrail),
      where('recordId', '==', riskId),
      limit(300),
    ));
    return snap.docs
      .map((d) => mapToRiskAuditEntry({ id: d.id, ...d.data() }, riskId))
      .filter(isVisibleRiskAuditEntry);
  } catch {
    return [];
  }
}

export async function fetchRiskAuditTrail(
  riskId: string,
  riskNumber?: string,
): Promise<RiskAuditEntry[]> {
  let record: RiskAssessmentRecord | null = null;
  if (!riskNumber) {
    record = await fetchRiskAssessmentById(riskId);
    riskNumber = record?.riskNumber;
  }

  const [fromGlobal, fromDocId, fromRecordId] = await Promise.all([
    fetchGlobalRiskTrail(riskId, riskNumber),
    fetchDocumentIdTrail(riskId),
    fetchRecordIdTrail(riskId),
  ]);

  return dedupeEntries([...fromGlobal, ...fromDocId, ...fromRecordId])
    .sort((a, b) => b.date_time.localeCompare(a.date_time));
}

export async function fetchAllRiskAuditEntries(): Promise<RiskAuditEntry[]> {
  const [fromGlobal, risks] = await Promise.all([
    fetchGlobalRiskTrail(),
    fetchRiskAssessmentRecords(500),
  ]);
  const numberById = new Map(risks.map((r) => [r.id, r.riskNumber]));

  const enriched = fromGlobal.map((e) => {
    const rid = e.risk_assessment_id;
    return {
      ...e,
      risk_number: e.risk_number || numberById.get(rid) || '',
    };
  });

  return dedupeEntries(enriched)
    .filter(isVisibleRiskAuditEntry)
    .sort((a, b) => b.date_time.localeCompare(a.date_time));
}

export async function getFilteredRiskAuditTrail(input: {
  riskId?: string;
  riskNumber?: string;
  role?: string | null;
  filters?: RiskAuditFilters;
}): Promise<RiskAuditEntry[]> {
  const base = input.riskId
    ? await fetchRiskAuditTrail(input.riskId, input.riskNumber)
    : await fetchAllRiskAuditEntries();

  const scoped = filterRiskAuditByRole(base, input.role);
  return applyRiskAuditFilters(scoped, input.filters || {});
}

export async function logRiskAuditExport(
  actor: ReportActor,
  riskId: string,
  riskNumber: string,
  format: 'PDF' | 'Excel',
  count: number,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: RISK_COLLECTIONS.assessments,
    recordId: riskId,
    documentNumber: riskNumber,
    actionType: 'Exported',
    actionDescription: `Risk audit trail exported as ${format} (${count} records)`,
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });
}

export async function logRiskAuditPreviewed(
  actor: ReportActor,
  riskId: string,
  riskNumber: string,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: RISK_COLLECTIONS.assessments,
    recordId: riskId,
    documentNumber: riskNumber,
    actionType: 'Updated',
    actionDescription: 'Risk audit trail viewed',
    user: { id: actor.id, name: actor.name, role: actor.role },
    status: 'Success',
  });
}

export function buildRiskAuditPdfHtml(
  entries: RiskAuditEntry[],
  riskNumber: string,
  generatedBy: string,
  filters: RiskAuditFilters,
): string {
  const filterLine = [
    filters.risk_number && filters.risk_number !== 'all' ? `Risk: ${filters.risk_number}` : null,
    filters.action_type && filters.action_type !== 'all' ? `Action: ${filters.action_type}` : null,
    filters.module_name && filters.module_name !== 'all' ? `Module: ${filters.module_name}` : null,
    filters.start_date ? `From: ${filters.start_date}` : null,
    filters.end_date ? `To: ${filters.end_date}` : null,
    filters.search ? `Search: ${filters.search}` : null,
  ].filter(Boolean).join(' | ');

  const rows = entries.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.date_time ? new Date(e.date_time).toLocaleString() : '—'}</td>
      <td>${e.risk_number || riskNumber}</td>
      <td>${e.action_type}</td>
      <td>${e.module_name}</td>
      <td>${e.field_name || '—'}</td>
      <td>${e.old_value.slice(0, 40) || '—'}</td>
      <td>${e.new_value.slice(0, 40) || '—'}</td>
      <td>${e.changed_by_name}</td>
      <td>${e.status}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Risk Audit Trail</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#1e293b;font-size:11px}
.header{border:2px solid #000;padding:12px;margin-bottom:16px;text-align:center}
h1{color:#1e40af;margin:0 0 4px} .meta{color:#64748b;font-size:11px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #cbd5e1;padding:5px;text-align:left}
th{background:#f1f5f9}
</style></head><body>
<div class="header">
  <strong>SKYMAP PHARMACEUTICALS PVT. LTD.</strong><br/>
  <h1>Risk Audit Trail Report — ICH Q9 / GMP</h1>
  <p class="meta">Risk: ${riskNumber || 'All'} | 21 CFR Part 11 | Generated: ${new Date().toLocaleString()}</p>
  <p class="meta">Generated by: ${generatedBy}</p>
  ${filterLine ? `<p class="meta">Filters: ${filterLine}</p>` : ''}
  <p class="meta">Total records: ${entries.length} | Append-only — cannot edit or delete</p>
</div>
<table>
<thead><tr><th>#</th><th>Date Time</th><th>Risk No</th><th>Action</th><th>Module</th><th>Field</th><th>Old</th><th>New</th><th>User</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<button onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}

export function openRiskAuditPdfReport(
  entries: RiskAuditEntry[],
  riskNumber: string,
  generatedBy: string,
  filters: RiskAuditFilters,
): void {
  const html = buildRiskAuditPdfHtml(entries, riskNumber, generatedBy, filters);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/** Backward-compatible helper for risk detail views */
export async function getAuditLogsForRisk(riskId: string): Promise<Record<string, unknown>[]> {
  const entries = await fetchRiskAuditTrail(riskId);
  return entries.map((e) => ({
    id: e.id,
    auditId: e.audit_id,
    dateTime: e.date_time,
    action: e.action_type,
    actionType: e.action_type,
    actionDescription: e.action_description,
    fieldName: e.field_name,
    oldValue: e.old_value,
    newValue: e.new_value,
    userId: e.changed_by,
    userName: e.changed_by_name,
    changedByRole: e.changed_by_role,
    department: e.department,
    reason: e.reason,
    ipAddress: e.ip_address,
    device: e.device_info,
    module: e.module_name,
    moduleName: e.module_name,
    recordId: e.risk_assessment_id,
    documentNumber: e.risk_number,
    status: e.status,
  }));
}
