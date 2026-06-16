import {
  addDoc, collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createRecord, getRecord, getRecords, updateRecord, type DocumentActor } from '@/lib/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { listCpvRecords } from '@/lib/cpv-service';
import { CPV_COLLECTIONS, CppRecord, CqaRecord } from '@/lib/cpv';
import { fetchStabilityResults } from '@/lib/cpv-stability-monitoring-service';
import { fetchHoldTimeRecords } from '@/lib/cpv-hold-time-monitoring-service';
import { fetchProcessCapabilityRecords } from '@/lib/cpv-process-capability-service';
import { fetchTrendAnalysisRecords } from '@/lib/cpv-trend-analysis-service';
import { fetchSpcRecords } from '@/lib/cpv-spc-service';
import { fetchRawMaterialRecords } from '@/lib/cpv-raw-material-monitoring-service';
import { fetchPackingMaterialRecords } from '@/lib/cpv-packing-material-monitoring-service';
import { fetchUtilityRecords } from '@/lib/cpv-utility-monitoring-service';
import { fetchEnvironmentalRecords } from '@/lib/cpv-environmental-monitoring-service';
import { fetchYieldRecords } from '@/lib/cpv-yield-monitoring-service';
import { fetchRiskAssessmentRecords } from '@/lib/cpv-risk-assessment-service';
import { fetchCpvReviewRecords } from '@/lib/cpv-annual-review-service';
import {
  ALERTS_COLLECTION,
  ALERTS_LEGACY,
  ALERT_ESCALATIONS_COLLECTION,
  ALERT_NOTIFICATIONS_COLLECTION,
  ALERT_RULES_COLLECTION,
  CPV_ALERT_MODULE,
  buildDefaultAlertRules,
  buildAlertId,
  generateAlertNumber,
  inferAlertFromRecord,
  mapLegacyPriority,
  mapLegacySeverity,
  type AlertSource,
  type AlertTimelineEntry,
  type AlertType,
  type CpvAlertFormData,
  type CpvAlertRecord,
  type CpvAlertRuleFormData,
  type CpvAlertRuleRecord,
} from '@/lib/cpv-alert-records';

export type CpvAlertActor = { id: string; name: string; role?: string };

function actorCtx(actor: CpvAlertActor) {
  return { moduleName: CPV_ALERT_MODULE, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logAlertAudit(
  actionType: string,
  recordId: string,
  actor: CpvAlertActor,
  oldVal?: unknown,
  newVal?: unknown,
  docNo?: string,
) {
  try {
    await createAuditLog({
      moduleName: CPV_ALERT_MODULE,
      collectionName: ALERTS_COLLECTION,
      recordId,
      documentNumber: docNo,
      actionType,
      oldValue: oldVal,
      newValue: newVal,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: ALERTS_COLLECTION,
      documentId: recordId,
      action: actionType,
      oldValue: oldVal,
      newValue: newVal,
      userId: actor.id,
      userName: actor.name,
      moduleName: CPV_ALERT_MODULE,
    });
  } catch (e) {
    console.error('logAlertAudit failed', e);
  }
}

function str(v: unknown, fb = ''): string {
  if (v === null || v === undefined) return fb;
  return String(v);
}

function num(v: unknown, fb = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function val(v: unknown, fb: string | number = ''): string | number {
  if (v === null || v === undefined) return fb;
  if (typeof v === 'number' || typeof v === 'string') return v;
  return String(v);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function createNotification(title: string, message: string, role: string, alertId: string, actor: CpvAlertActor) {
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), 'notifications'), {
      title,
      message,
      type: 'CPV Alert',
      targetRole: role,
      alertId,
      read: false,
      createdAt: new Date().toISOString(),
      createdBy: actor.id,
      isDeleted: false,
    });
    await addDoc(collection(getFirebaseFirestore(), ALERT_NOTIFICATIONS_COLLECTION), {
      alertId,
      title,
      message,
      targetRole: role,
      sentAt: new Date().toISOString(),
      createdBy: actor.id,
      isDeleted: false,
    });
  } catch (e) {
    console.error('createNotification failed', e);
  }
}

export function normalizeAlertRecord(raw: Record<string, unknown>): CpvAlertRecord {
  const legacyModule = str(raw.module || raw.moduleName || raw.module_name, 'Manual Alert');
  const legacySeverity = str(raw.severity || raw.alertSeverity, 'Medium');
  const legacyStatus = str(raw.status || raw.alertStatus, 'Open');
  const statusMap: Record<string, CpvAlertRecord['alertStatus']> = {
    Open: 'Open', Acknowledged: 'Acknowledged', Closed: 'Closed',
  };

  return {
    id: str(raw.id),
    alertId: str(raw.alertId || raw.alert_id, buildAlertId()),
    alertNumber: str(raw.alertNumber || raw.alert_number, `ALT/DRAFT/${Date.now()}`),
    alertTitle: str(raw.alertTitle || raw.alert_title || raw.message, 'CPV Alert'),
    alertSource: str(raw.alertSource || raw.alert_source, legacyModule) as AlertSource,
    moduleName: str(raw.moduleName || raw.module_name || raw.module, legacyModule),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    batchNumber: str(raw.batchNumber || raw.batch_number || raw.batchNo),
    parameterName: str(raw.parameterName || raw.parameter_name),
    observedValue: val(raw.observedValue ?? raw.observed_value),
    limitValue: val(raw.limit ?? raw.limitValue ?? raw.limit_value),
    alertType: str(raw.alertType || raw.alert_type, 'Alert Limit Crossed') as CpvAlertRecord['alertType'],
    alertPriority: str(raw.alertPriority || raw.alert_priority, mapLegacyPriority(legacySeverity)) as CpvAlertRecord['alertPriority'],
    alertSeverity: str(raw.alertSeverity || raw.alert_severity, mapLegacySeverity(legacySeverity)) as CpvAlertRecord['alertSeverity'],
    alertStatus: statusMap[legacyStatus] || str(raw.alertStatus, 'Open') as CpvAlertRecord['alertStatus'],
    riskLevel: str(raw.riskLevel || raw.risk_level, mapLegacyPriority(legacySeverity)) as CpvAlertRecord['riskLevel'],
    alertMessage: str(raw.alertMessage || raw.alert_message || raw.message),
    detectedDateTime: str(raw.detectedDateTime || raw.detected_date_time || raw.createdAt),
    assignedTo: str(raw.assignedTo || raw.assigned_to),
    assignedRole: str(raw.assignedRole || raw.assigned_role, 'qa'),
    dueDate: str(raw.dueDate || raw.due_date),
    acknowledgedBy: str(raw.acknowledgedBy || raw.acknowledged_by),
    acknowledgedDateTime: str(raw.acknowledgedDateTime || raw.acknowledged_date_time),
    closedBy: str(raw.closedBy || raw.closed_by),
    closedDateTime: str(raw.closedDateTime || raw.closed_date_time),
    closureRemarks: str(raw.closureRemarks || raw.closure_remarks),
    linkedDeviationNumber: str(raw.linkedDeviationNumber || raw.linked_deviation_number),
    linkedOosNumber: str(raw.linkedOosNumber || raw.linked_oos_number),
    linkedCapaNumber: str(raw.linkedCapaNumber || raw.linked_capa_number),
    linkedRiskNumber: str(raw.linkedRiskNumber || raw.linked_risk_number),
    sourceRecordId: str(raw.sourceRecordId || raw.source_record_id || raw.recordId),
    timeline: Array.isArray(raw.timeline) ? raw.timeline as AlertTimelineEntry[] : [],
    createdAt: str(raw.createdAt),
    updatedAt: str(raw.updatedAt),
    createdBy: str(raw.createdBy),
    updatedBy: str(raw.updatedBy),
    createdByName: str(raw.createdByName || raw.createdBy),
    updatedByName: str(raw.updatedByName || raw.updatedBy),
    isDeleted: Boolean(raw.isDeleted),
  };
}

function duplicateKey(moduleName: string, recordId: string, alertType: string) {
  return `${moduleName}|${recordId}|${alertType}`;
}

export async function fetchCpvAlerts(max = 500): Promise<CpvAlertRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const map = new Map<string, CpvAlertRecord>();
    const load = async (collectionName: string) => {
      try {
        const rows = await getRecords<Record<string, unknown>>(collectionName, [orderBy('createdAt', 'desc'), limit(max)]);
        rows.forEach((r) => {
          const n = normalizeAlertRecord({ ...r, id: r.id });
          if (!n.isDeleted) map.set(n.id || duplicateKey(n.moduleName, n.sourceRecordId, n.alertType), n);
        });
      } catch {
        const rows = await getRecords<Record<string, unknown>>(collectionName, [limit(max)]);
        rows.forEach((r) => {
          const n = normalizeAlertRecord({ ...r, id: r.id });
          if (!n.isDeleted) map.set(n.id || duplicateKey(n.moduleName, n.sourceRecordId, n.alertType), n);
        });
      }
    };
    await load(ALERTS_COLLECTION);
    for (const legacy of ALERTS_LEGACY) await load(legacy);
    return Array.from(map.values()).sort((a, b) =>
      String(b.detectedDateTime || b.createdAt).localeCompare(String(a.detectedDateTime || a.createdAt)),
    );
  } catch (e) {
    console.error('fetchCpvAlerts failed', e);
    return [];
  }
}

export async function fetchCpvAlertById(id: string): Promise<CpvAlertRecord | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const record = await getRecord<Record<string, unknown>>(ALERTS_COLLECTION, id);
    if (record) return normalizeAlertRecord(record);
    for (const legacy of ALERTS_LEGACY) {
      const legacyRecord = await getRecord<Record<string, unknown>>(legacy, id);
      if (legacyRecord) return normalizeAlertRecord(legacyRecord);
    }
    return null;
  } catch (e) {
    console.error('fetchCpvAlertById failed', e);
    return null;
  }
}

export async function fetchAlertRules(): Promise<CpvAlertRuleRecord[]> {
  if (!isFirebaseConfigured()) return buildDefaultAlertRules();
  try {
    const rows = await getRecords<CpvAlertRuleRecord>(ALERT_RULES_COLLECTION, [limit(100)]);
    if (rows.length) return rows.map((r) => ({ ...r, id: r.id || r.ruleId }));
    return buildDefaultAlertRules();
  } catch (e) {
    console.error('fetchAlertRules failed', e);
    return [];
  }
}

export async function fetchAlertAuditTrail(alertId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', alertId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), limit(100)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((r: Record<string, unknown>) => String(r.documentId || r.recordId) === alertId);
    } catch (e) {
      console.error('fetchAlertAuditTrail failed', e);
      return [];
    }
  }
}

async function isDuplicateAlert(
  moduleName: string,
  sourceRecordId: string,
  alertType: string,
  suppressionHours: number,
  existing: CpvAlertRecord[],
): Promise<boolean> {
  const key = duplicateKey(moduleName, sourceRecordId, alertType);
  const match = existing.find((a) =>
    duplicateKey(a.moduleName, a.sourceRecordId, a.alertType) === key
    && !['Closed', 'Rejected'].includes(a.alertStatus),
  );
  if (!match) return false;
  if (!suppressionHours) return true;
  const created = new Date(match.detectedDateTime || match.createdAt);
  const hours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return hours < suppressionHours;
}

export async function createCpvAlert(
  form: CpvAlertFormData,
  actor: CpvAlertActor,
  existingCount = 0,
  options?: { sourceRecordId?: string; autoCreated?: boolean },
): Promise<{ result: CpvAlertRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const year = new Date().getFullYear();
    const alertNumber = generateAlertNumber(year, existingCount);
    const alertId = buildAlertId();
    const now = new Date().toISOString();
    const timeline: AlertTimelineEntry[] = [{
      action: options?.autoCreated ? 'alert auto-created' : 'manual alert created',
      user: actor.name,
      at: now,
    }];

    const payload = {
      alertId,
      alertNumber,
      ...form,
      alertStatus: 'Open' as const,
      riskLevel: form.alertPriority,
      detectedDateTime: now,
      dueDate: form.dueDate || addDays(['Critical', 'High'].includes(form.alertPriority) ? 1 : 3),
      sourceRecordId: options?.sourceRecordId || '',
      timeline,
      acknowledgedBy: '',
      acknowledgedDateTime: '',
      closedBy: '',
      closedDateTime: '',
      closureRemarks: '',
      linkedDeviationNumber: '',
      linkedOosNumber: '',
      linkedCapaNumber: '',
      linkedRiskNumber: '',
      createdByName: actor.name,
      updatedByName: actor.name,
    };

    const created = await createRecord(
      ALERTS_COLLECTION,
      payload as unknown as Omit<CpvAlertRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    const result = normalizeAlertRecord(created as unknown as Record<string, unknown>);
    await logAlertAudit(options?.autoCreated ? 'alert auto-created' : 'manual alert created', result.id, actor, null, result, result.alertNumber);
    await createNotification(result.alertTitle, result.alertMessage, form.assignedRole || 'qa', result.id, actor);
    if (['High', 'Critical'].includes(form.alertPriority)) {
      await createNotification(result.alertTitle, result.alertMessage, 'qa', result.id, actor);
    }
    if (form.alertPriority === 'Critical') {
      await createNotification(result.alertTitle, result.alertMessage, 'head_qa', result.id, actor);
    }
    return { result, error: null };
  } catch (e) {
    console.error('createCpvAlert failed', e);
    return { result: null, error: 'Failed to create alert.' };
  }
}

export async function acknowledgeCpvAlert(id: string, actor: CpvAlertActor, existing: CpvAlertRecord) {
  try {
    const now = new Date().toISOString();
    const timeline = [...(existing.timeline || []), { action: 'alert acknowledged', user: actor.name, at: now }];
    await updateRecord(ALERTS_COLLECTION, id, {
      alertStatus: 'Acknowledged',
      acknowledgedBy: actor.name,
      acknowledgedDateTime: now,
      timeline,
      updatedByName: actor.name,
    }, actorCtx(actor));
    await logAlertAudit('alert acknowledged', id, actor, existing.alertStatus, 'Acknowledged', existing.alertNumber);
    return { error: null };
  } catch (e) {
    console.error('acknowledgeCpvAlert failed', e);
    return { error: 'Acknowledge failed.' };
  }
}

export async function assignCpvAlert(id: string, assignedTo: string, assignedRole: string, actor: CpvAlertActor, existing: CpvAlertRecord) {
  try {
    const now = new Date().toISOString();
    const timeline = [...(existing.timeline || []), { action: 'alert assigned', user: actor.name, at: now, remarks: `${assignedRole}: ${assignedTo}` }];
    await updateRecord(ALERTS_COLLECTION, id, { assignedTo, assignedRole, timeline, updatedByName: actor.name }, actorCtx(actor));
    await logAlertAudit('alert assigned', id, actor, existing.assignedTo, assignedTo, existing.alertNumber);
    await createNotification(`Alert assigned: ${existing.alertNumber}`, existing.alertMessage, assignedRole, id, actor);
    return { error: null };
  } catch (e) {
    console.error('assignCpvAlert failed', e);
    return { error: 'Assign failed.' };
  }
}

export async function linkCpvAlert(
  id: string,
  linkType: 'linkedDeviationNumber' | 'linkedOosNumber' | 'linkedCapaNumber' | 'linkedRiskNumber',
  linkValue: string,
  actor: CpvAlertActor,
  existing: CpvAlertRecord,
) {
  const statusMap: Record<string, CpvAlertRecord['alertStatus']> = {
    linkedDeviationNumber: 'Linked to Deviation',
    linkedOosNumber: 'Linked to OOS',
    linkedCapaNumber: 'Linked to CAPA',
    linkedRiskNumber: 'Under Investigation',
  };
  const auditMap: Record<string, string> = {
    linkedDeviationNumber: 'alert linked to deviation',
    linkedOosNumber: 'alert linked to OOS',
    linkedCapaNumber: 'alert linked to CAPA',
    linkedRiskNumber: 'alert linked to risk',
  };
  try {
    const now = new Date().toISOString();
    const timeline = [...(existing.timeline || []), { action: auditMap[linkType], user: actor.name, at: now, remarks: linkValue }];
    await updateRecord(ALERTS_COLLECTION, id, {
      [linkType]: linkValue,
      alertStatus: statusMap[linkType],
      timeline,
      updatedByName: actor.name,
    }, actorCtx(actor));
    await logAlertAudit(auditMap[linkType], id, actor, null, linkValue, existing.alertNumber);
    return { error: null };
  } catch (e) {
    console.error('linkCpvAlert failed', e);
    return { error: 'Link failed.' };
  }
}

export async function closeCpvAlert(id: string, closureRemarks: string, actor: CpvAlertActor, existing: CpvAlertRecord) {
  if (!closureRemarks.trim()) return { error: 'Closure remarks required.' };
  try {
    const now = new Date().toISOString();
    const timeline = [...(existing.timeline || []), { action: 'alert closed', user: actor.name, at: now, remarks: closureRemarks }];
    await updateRecord(ALERTS_COLLECTION, id, {
      alertStatus: 'Closed',
      closedBy: actor.name,
      closedDateTime: now,
      closureRemarks,
      timeline,
      updatedByName: actor.name,
    }, actorCtx(actor));
    await logAlertAudit('alert closed', id, actor, existing.alertStatus, 'Closed', existing.alertNumber);
    return { error: null };
  } catch (e) {
    console.error('closeCpvAlert failed', e);
    return { error: 'Close failed.' };
  }
}

export async function rejectCpvAlert(id: string, remarks: string, actor: CpvAlertActor, existing: CpvAlertRecord) {
  try {
    const now = new Date().toISOString();
    const timeline = [...(existing.timeline || []), { action: 'alert rejected', user: actor.name, at: now, remarks }];
    await updateRecord(ALERTS_COLLECTION, id, { alertStatus: 'Rejected', closureRemarks: remarks, timeline, updatedByName: actor.name }, actorCtx(actor));
    await logAlertAudit('alert rejected', id, actor, existing.alertStatus, 'Rejected', existing.alertNumber);
    return { error: null };
  } catch (e) {
    console.error('rejectCpvAlert failed', e);
    return { error: 'Reject failed.' };
  }
}

export async function escalateCpvAlert(id: string, actor: CpvAlertActor, existing: CpvAlertRecord, escalationRole = 'head_qa') {
  try {
    const now = new Date().toISOString();
    const timeline = [...(existing.timeline || []), { action: 'alert escalated', user: actor.name, at: now }];
    await updateRecord(ALERTS_COLLECTION, id, { alertStatus: 'Overdue', assignedRole: escalationRole, timeline, updatedByName: actor.name }, actorCtx(actor));
    await addDoc(collection(getFirebaseFirestore(), ALERT_ESCALATIONS_COLLECTION), {
      alertId: id,
      alertNumber: existing.alertNumber,
      escalationRole,
      escalatedBy: actor.name,
      escalatedAt: now,
      createdBy: actor.id,
      isDeleted: false,
    });
    await logAlertAudit('alert escalated', id, actor, existing.alertStatus, escalationRole, existing.alertNumber);
    await createNotification(`Escalated: ${existing.alertNumber}`, existing.alertMessage, escalationRole, id, actor);
    return { error: null };
  } catch (e) {
    console.error('escalateCpvAlert failed', e);
    return { error: 'Escalation failed.' };
  }
}

export async function saveAlertRule(form: CpvAlertRuleFormData, actor: CpvAlertActor, existingId?: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const payload = {
      ruleId: `RULE-${form.ruleCode}`,
      ...form,
      updatedByName: actor.name,
    };
    if (existingId && !existingId.startsWith('default-')) {
      await updateRecord(ALERT_RULES_COLLECTION, existingId, payload as Partial<CpvAlertRuleRecord>, actorCtx(actor));
      await logAlertAudit('alert rule edited', existingId, actor, null, form.ruleName);
    } else {
      const created = await createRecord(ALERT_RULES_COLLECTION, {
        ...payload,
        createdByName: actor.name,
      } as unknown as Omit<CpvAlertRuleRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>, actorCtx(actor));
      await logAlertAudit('alert rule created', created.id || '', actor, null, form.ruleName);
    }
    return { error: null };
  } catch (e) {
    console.error('saveAlertRule failed', e);
    return { error: 'Save rule failed.' };
  }
}

export async function deactivateAlertRule(id: string, actor: CpvAlertActor) {
  try {
    await updateRecord(ALERT_RULES_COLLECTION, id, { status: 'Inactive', updatedByName: actor.name }, actorCtx(actor));
    await logAlertAudit('alert rule deactivated', id, actor, 'Active', 'Inactive');
    return { error: null };
  } catch (e) {
    console.error('deactivateAlertRule failed', e);
    return { error: 'Deactivate failed.' };
  }
}

export async function scanAndCreateAlerts(actor: CpvAlertActor): Promise<{ created: number; error: string | null }> {
  if (!isFirebaseConfigured()) return { created: 0, error: 'Firebase is not configured.' };
  try {
    const [existing, rules, cpp, cqa, stability, holdTime, capability, spc, riskAssessment, utility, environmental, yieldRows, rawMaterial, packingMaterial, cpvReviews] = await Promise.all([
      fetchCpvAlerts(500),
      fetchAlertRules(),
      listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp, 500),
      listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa, 500),
      fetchStabilityResults(300),
      fetchHoldTimeRecords(300),
      fetchProcessCapabilityRecords(300),
      fetchSpcRecords(300),
      fetchRiskAssessmentRecords(300),
      fetchUtilityRecords(300),
      fetchEnvironmentalRecords(300),
      fetchYieldRecords(300),
      fetchRawMaterialRecords(300),
      fetchPackingMaterialRecords(300),
      fetchCpvReviewRecords(100),
    ]);

    const scans: Array<{ source: AlertSource; records: Record<string, unknown>[]; ruleModule: string }> = [
      { source: 'CPP Monitoring', records: cpp as unknown as Record<string, unknown>[], ruleModule: 'CPP Monitoring' },
      { source: 'CQA Monitoring', records: cqa as unknown as Record<string, unknown>[], ruleModule: 'CQA Monitoring' },
      { source: 'Stability Monitoring', records: stability as unknown as Record<string, unknown>[], ruleModule: 'Stability Monitoring' },
      { source: 'Hold Time Monitoring', records: holdTime as unknown as Record<string, unknown>[], ruleModule: 'Hold Time Monitoring' },
      { source: 'Process Capability', records: capability as unknown as Record<string, unknown>[], ruleModule: 'Process Capability' },
      { source: 'SPC', records: spc as unknown as Record<string, unknown>[], ruleModule: 'SPC' },
      { source: 'Risk Assessment', records: riskAssessment as unknown as Record<string, unknown>[], ruleModule: 'Risk Assessment' },
      { source: 'Utility Monitoring', records: utility as unknown as Record<string, unknown>[], ruleModule: 'Utility Monitoring' },
      { source: 'Environmental Monitoring', records: environmental as unknown as Record<string, unknown>[], ruleModule: 'Environmental Monitoring' },
      { source: 'Yield Monitoring', records: yieldRows as unknown as Record<string, unknown>[], ruleModule: 'Yield Monitoring' },
      { source: 'Raw Material Monitoring', records: rawMaterial as unknown as Record<string, unknown>[], ruleModule: 'Raw Material Monitoring' },
      { source: 'Packing Material Monitoring', records: packingMaterial as unknown as Record<string, unknown>[], ruleModule: 'Packing Material Monitoring' },
    ];

    let created = 0;
    for (const scan of scans) {
      const rule = rules.find((r) => r.moduleName === scan.ruleModule && r.status === 'Active');
      for (const record of scan.records.slice(0, 50)) {
        const inferred = inferAlertFromRecord(scan.source, record, rule);
        if (!inferred) continue;
        const recordId = str(record.id);
        const alertType = inferred.alertType as AlertType;
        const dup = await isDuplicateAlert(scan.source, recordId, alertType, rule?.repeatAlertSuppressionHours || 24, existing);
        if (dup) continue;
        const { result } = await createCpvAlert(inferred as CpvAlertFormData, actor, existing.length + created, {
          sourceRecordId: recordId,
          autoCreated: true,
        });
        if (result) {
          created++;
          existing.push(result);
        }
      }
    }

    const now = new Date();
    for (const review of cpvReviews) {
      if (['Approved', 'Archived'].includes(String(review.reviewStatus))) continue;
      const due = new Date(review.reviewPeriodTo || review.createdAt);
      if (due >= now) continue;
      const inferred: CpvAlertFormData = {
        alertTitle: 'CPV annual review overdue',
        alertSource: 'Manual Alert',
        moduleName: 'Annual CPV Review',
        productName: review.productName,
        productCode: review.productCode || '',
        batchNumber: '',
        parameterName: 'Annual Review',
        observedValue: '',
        limitValue: '',
        alertType: 'Overdue Review',
        alertPriority: 'Medium',
        alertSeverity: 'Warning',
        alertMessage: `Annual CPV review ${review.cpvReviewNumber} is overdue`,
        assignedRole: 'qa',
        assignedTo: '',
        dueDate: addDays(7),
      };
      const dup = await isDuplicateAlert('Annual CPV Review', review.id, 'Overdue Review', 72, existing);
      if (dup) continue;
      const { result } = await createCpvAlert(inferred, actor, existing.length + created, { sourceRecordId: review.id, autoCreated: true });
      if (result) { created++; existing.push(result); }
    }

    return { created, error: null };
  } catch (e) {
    console.error('scanAndCreateAlerts failed', e);
    return { created: 0, error: 'Scan failed.' };
  }
}

export async function logAlertExport(actor: CpvAlertActor, count: number) {
  await logAlertAudit('export alert list', 'export', actor, null, count);
}

/* Legacy compatibility */
export async function listAlerts(max = 200) {
  return fetchCpvAlerts(max);
}

export async function acknowledgeAlert(id: string, actor: { id?: string; name?: string }) {
  const existing = await fetchCpvAlertById(id);
  if (!existing) return;
  return acknowledgeCpvAlert(id, { id: actor.id || 'system', name: actor.name || 'System' }, existing);
}

export async function closeAlert(id: string, actor: { id?: string; name?: string }) {
  const existing = await fetchCpvAlertById(id);
  if (!existing) return;
  return closeCpvAlert(id, 'Closed via legacy action', { id: actor.id || 'system', name: actor.name || 'System' }, existing);
}
