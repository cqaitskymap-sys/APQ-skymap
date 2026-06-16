import {
  collection, doc, addDoc, getDocs, getDoc, updateDoc, query, where, limit, orderBy,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { CAPA_COLLECTIONS, type CapaRecord } from '@/lib/capa-types';
import { createCapa, getCapaById, getCapaEffectiveness } from '@/lib/capa-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  capaLinkFromCapaRecord,
  computeCapaLinkAutoRules,
  computeCapaMandatory,
  isCapaLinkOverdue,
  mapCapaRecordToDisplayStatus,
  type CapaLinkActor,
  type CapaLinkFormInput,
} from '@/lib/deviation-capa-records';
import {
  DEVIATION_COLLECTIONS,
  type DeviationCapaLink,
  type DeviationRecord,
} from '@/lib/deviation-types';
import { applyOverdueCheck, getDeviationById, updateDeviation } from '@/lib/deviation-service';

export type { CapaLinkActor, CapaLinkFormInput };

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(actor: CapaLinkActor, actionType: string, deviationId: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: 'Deviation CAPA Link',
      collectionName: DEVIATION_COLLECTIONS.capaLinks,
      recordId: deviationId,
      actionType,
      actionDescription: detail || actionType,
      reason: detail || '',
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
  } catch (e) {
    console.error('capa link audit', e);
  }
}

async function notify(title: string, message: string, deviationId: string, userId: string) {
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), DEVIATION_COLLECTIONS.notifications), {
      title, message, module: 'Deviation', record_id: deviationId, user_id: userId, read: false, created_at: nowIso(),
    });
  } catch (e) {
    console.error('capa link notify', e);
  }
}

async function findCapaByNumber(capaNumber: string): Promise<CapaRecord | null> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), CAPA_COLLECTIONS.records),
    where('capa_number', '==', capaNumber.trim()),
    limit(1),
  ));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as CapaRecord;
}

export async function getActiveCapaLink(deviationId: string): Promise<DeviationCapaLink | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DEVIATION_COLLECTIONS.capaLinks),
      where('deviation_id', '==', deviationId),
      where('is_active', '==', true),
      limit(1),
    ));
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as DeviationCapaLink;
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DEVIATION_COLLECTIONS.capaLinks),
      where('deviation_id', '==', deviationId),
      limit(5),
    ));
    const active = snap.docs.find((d) => d.data().is_active !== false);
    if (!active) return null;
    return { id: active.id, ...active.data() } as DeviationCapaLink;
  }
}

export async function getCapaLinkHistory(deviationId: string): Promise<DeviationCapaLink[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DEVIATION_COLLECTIONS.capaLinks),
      where('deviation_id', '==', deviationId),
      orderBy('created_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeviationCapaLink));
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DEVIATION_COLLECTIONS.capaLinks),
      where('deviation_id', '==', deviationId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeviationCapaLink))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

async function syncDeviationCapaStatus(
  deviationId: string,
  capaRequired: boolean,
  capa: CapaRecord | null,
  actor: CapaLinkActor,
) {
  const displayStatus = capa ? mapCapaRecordToDisplayStatus(capa.capa_status, capa.target_completion_date) : '';
  const isOpen = capa && !['Closed', 'Overdue'].includes(displayStatus) ? displayStatus !== 'Closed' : false;
  const status = capaRequired && capa && isOpen && displayStatus !== 'Closed'
    ? 'capa_required'
    : undefined;

  await updateDeviation(deviationId, {
    capa_required: capaRequired,
    linked_capa_number: capa?.capa_number || null,
    linked_capa_id: capa?.id || null,
    ...(status ? { status } : {}),
  }, { id: actor.id, name: actor.name, role: actor.role || 'qa' }, { workflow: true });
}

async function writeCapaLink(
  payload: Omit<DeviationCapaLink, 'id'>,
  actor: CapaLinkActor,
  action: string,
): Promise<DeviationCapaLink> {
  const ref = await addDoc(collection(getFirebaseFirestore(), DEVIATION_COLLECTIONS.capaLinks), payload);
  await audit(actor, action, payload.deviation_id, `${payload.capa_number}: ${action}`);
  return { id: ref.id, ...payload };
}

async function deactivateExistingLinks(deviationId: string, actor: CapaLinkActor) {
  const history = await getCapaLinkHistory(deviationId);
  await Promise.all(history.filter((h) => h.is_active).map(async (h) => {
    await updateDoc(doc(getFirebaseFirestore(), DEVIATION_COLLECTIONS.capaLinks, h.id), {
      is_active: false,
      updated_at: nowIso(),
      updated_by: actor.id,
      updated_by_name: actor.name,
    });
  }));
}

export async function fetchCapaLinkPageData(deviationId: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const record = await getDeviationById(deviationId);
    if (!record) return { error: 'Deviation not found.' };
    const link = await getActiveCapaLink(deviationId);
    let capa: CapaRecord | null = null;
    if (link?.capa_id) capa = await getCapaById(link.capa_id);
    else if (record.linked_capa_id) capa = await getCapaById(record.linked_capa_id);
    const history = await getCapaLinkHistory(deviationId);
    const effectiveness = capa ? await getCapaEffectiveness(capa.id) : null;
    return {
      record: applyOverdueCheck(record),
      link: link ? { ...link, capa_status: mapCapaRecordToDisplayStatus(capa?.capa_status, capa?.target_completion_date) || link.capa_status } : null,
      capa,
      history,
      effectiveness: effectiveness ? [effectiveness] : [],
      autoRules: computeCapaLinkAutoRules(record),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load CAPA link data' };
  }
}

export async function listCapaLinkDeviations(max = 100): Promise<(DeviationRecord & { link?: DeviationCapaLink | null })[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DEVIATION_COLLECTIONS.deviations),
      orderBy('updated_at', 'desc'),
      limit(max),
    ));
    const records = snap.docs
      .map((d) => applyOverdueCheck({ id: d.id, ...d.data() } as DeviationRecord))
      .filter((r) => !r.is_deleted && (r.capa_required || r.linked_capa_number || computeCapaMandatory(r)));

    return Promise.all(records.map(async (r) => ({
      ...r,
      link: await getActiveCapaLink(r.id),
    })));
  } catch (e) {
    console.error('listCapaLinkDeviations', e);
    return [];
  }
}

export async function saveCapaRequirement(
  deviationId: string,
  capaRequired: boolean,
  remarks: string,
  actor: CapaLinkActor,
): Promise<{ error?: string }> {
  const record = await getDeviationById(deviationId);
  if (!record) return { error: 'Deviation not found' };
  const mandatory = computeCapaMandatory(record);
  if (mandatory && !capaRequired) return { error: 'CAPA is mandatory for this deviation and cannot be set to No.' };

  try {
    await updateDeviation(deviationId, {
      capa_required: capaRequired || mandatory,
      status: (capaRequired || mandatory) ? 'capa_required' : record.status,
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' }, { workflow: true });
    await audit(actor, 'CAPA Required Changed', deviationId, capaRequired ? 'CAPA required' : 'CAPA not required');
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to save CAPA requirement' };
  }
}

export async function linkExistingCapaToDeviation(
  deviationId: string,
  capaNumber: string,
  remarks: string,
  actor: CapaLinkActor,
): Promise<{ link?: DeviationCapaLink; error?: string }> {
  if (!capaNumber.trim()) return { error: 'CAPA number is required' };
  const record = await getDeviationById(deviationId);
  if (!record) return { error: 'Deviation not found' };

  const capa = await findCapaByNumber(capaNumber);
  if (!capa) return { error: `CAPA ${capaNumber} not found` };

  try {
    await deactivateExistingLinks(deviationId, actor);
    const capaRequired = record.capa_required || computeCapaMandatory(record);
    const payload = capaLinkFromCapaRecord(deviationId, record.deviation_number, capa, capaRequired, actor, remarks);
    const link = await writeCapaLink(payload, actor, 'CAPA Linked');

    await updateDoc(doc(getFirebaseFirestore(), CAPA_COLLECTIONS.records, capa.id), {
      deviation_id: deviationId,
      updated_at: nowIso(),
    });

    await syncDeviationCapaStatus(deviationId, capaRequired, capa, actor);
    await notify('CAPA Linked to Deviation', `${capa.capa_number} linked to ${record.deviation_number}`, deviationId, capa.action_owner);
    return { link };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to link CAPA' };
  }
}

export async function createCapaLinkFromDeviation(
  deviationId: string,
  input: CapaLinkFormInput,
  actor: CapaLinkActor,
): Promise<{ link?: DeviationCapaLink; capa?: CapaRecord; error?: string }> {
  const record = await getDeviationById(deviationId);
  if (!record) return { error: 'Deviation not found' };
  const capaRequired = input.capa_required || computeCapaMandatory(record);

  if (capaRequired && !input.corrective_action.trim()) return { error: 'Corrective action is required' };
  if (capaRequired && !input.preventive_action.trim()) return { error: 'Preventive action is required' };
  if (capaRequired && !input.responsible_person_name.trim()) return { error: 'Responsible person is required' };
  if (capaRequired && !input.target_completion_date) return { error: 'Target completion date is required' };

  try {
    const capa = await createCapa({
      capa_date: today(),
      capa_source: input.capa_source || 'Deviation',
      source_reference_number: record.deviation_number,
      department: record.department || 'QA',
      product_name: record.product_name || '',
      batch_number: record.batch_number || '',
      capa_title: input.capa_title || `CAPA for ${record.deviation_number}`,
      problem_description: record.description || record.title,
      root_cause: input.root_cause || record.root_cause || '',
      corrective_action: input.corrective_action,
      preventive_action: input.preventive_action,
      action_owner: actor.id,
      action_owner_name: input.responsible_person_name,
      target_completion_date: input.target_completion_date,
      effectiveness_check_required: input.effectiveness_check_required,
      effectiveness_criteria: 'Verify deviation root cause addressed and no recurrence',
      priority: record.criticality === 'Critical' ? 'critical' : record.criticality === 'Major' ? 'high' : 'medium',
      qa_remarks: input.remarks || '',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' }, {
      status: 'submitted',
      deviation_id: deviationId,
    });

    await deactivateExistingLinks(deviationId, actor);
    const payload = capaLinkFromCapaRecord(deviationId, record.deviation_number, capa, capaRequired, actor, input.remarks || '');
    const link = await writeCapaLink(payload, actor, 'CAPA Created');
    await syncDeviationCapaStatus(deviationId, capaRequired, capa, actor);
    await audit(actor, 'CAPA Created', deviationId, capa.capa_number);
    await notify('CAPA Created from Deviation', `${capa.capa_number} assigned to you`, deviationId, capa.action_owner);

    return { link, capa };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to create CAPA' };
  }
}

export async function unlinkCapaFromDeviation(
  deviationId: string,
  reason: string,
  actor: CapaLinkActor,
): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: 'Unlink reason is required' };
  const link = await getActiveCapaLink(deviationId);
  const record = await getDeviationById(deviationId);
  if (!record) return { error: 'Deviation not found' };

  try {
    if (link) {
      await updateDoc(doc(getFirebaseFirestore(), DEVIATION_COLLECTIONS.capaLinks, link.id), {
        is_active: false,
        unlink_reason: reason,
        unlinked_at: nowIso(),
        unlinked_by: actor.id,
        unlinked_by_name: actor.name,
        updated_at: nowIso(),
      });
    }
    await updateDeviation(deviationId, {
      linked_capa_number: null,
      linked_capa_id: null,
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' }, { workflow: true });
    await audit(actor, 'CAPA Unlinked', deviationId, reason);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to unlink CAPA' };
  }
}

export async function refreshCapaLinkStatus(deviationId: string, actor: CapaLinkActor): Promise<void> {
  const link = await getActiveCapaLink(deviationId);
  if (!link?.capa_id) return;
  const capa = await getCapaById(link.capa_id);
  if (!capa) return;
  const displayStatus = mapCapaRecordToDisplayStatus(capa.capa_status, capa.target_completion_date);
  await updateDoc(doc(getFirebaseFirestore(), DEVIATION_COLLECTIONS.capaLinks, link.id), {
    capa_status: displayStatus,
    effectiveness_check_date: capa.effectiveness_check_date,
    effectiveness_result: capa.effectiveness_result,
    corrective_action: capa.corrective_action,
    preventive_action: capa.preventive_action,
    updated_at: nowIso(),
  });
  const record = await getDeviationById(deviationId);
  if (record) await syncDeviationCapaStatus(deviationId, record.capa_required, capa, actor);
  if (displayStatus === 'Overdue') await audit(actor, 'CAPA Status Update', deviationId, 'Overdue');
}

export async function updateLinkedCapaStatus(
  deviationId: string,
  newStatus: string,
  actor: CapaLinkActor,
): Promise<{ error?: string }> {
  const link = await getActiveCapaLink(deviationId);
  if (!link?.capa_id) return { error: 'No linked CAPA found' };

  const statusMap: Record<string, string> = {
    Open: 'submitted',
    'Under Implementation': 'under_implementation',
    'Effectiveness Pending': 'effectiveness_pending',
    Closed: 'closed',
    Overdue: 'overdue',
    Draft: 'draft',
  };

  try {
    await updateDoc(doc(getFirebaseFirestore(), CAPA_COLLECTIONS.records, link.capa_id), {
      capa_status: statusMap[newStatus] || newStatus.toLowerCase(),
      updated_at: nowIso(),
      updated_by: actor.id,
      updated_by_name: actor.name,
    });
    await updateDoc(doc(getFirebaseFirestore(), DEVIATION_COLLECTIONS.capaLinks, link.id), {
      capa_status: newStatus,
      updated_at: nowIso(),
      updated_by: actor.id,
      updated_by_name: actor.name,
    });
    await audit(actor, 'CAPA Status Update', deviationId, newStatus);
    const capa = await getCapaById(link.capa_id);
    const record = await getDeviationById(deviationId);
    if (record && capa) await syncDeviationCapaStatus(deviationId, record.capa_required, capa, actor);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to update CAPA status' };
  }
}

export function mapCapaLinkFormDefaults(record: DeviationRecord, link?: DeviationCapaLink | null, capa?: CapaRecord | null): CapaLinkFormInput {
  return {
    capa_required: link?.capa_required ?? record.capa_required ?? computeCapaMandatory(record),
    capa_number: link?.capa_number || record.linked_capa_number || '',
    capa_title: link?.capa_title || capa?.capa_title || `CAPA for ${record.deviation_number}`,
    capa_source: link?.capa_source || capa?.capa_source || 'Deviation',
    root_cause: link?.root_cause || capa?.root_cause || record.root_cause || '',
    corrective_action: link?.corrective_action || capa?.corrective_action || '',
    preventive_action: link?.preventive_action || capa?.preventive_action || '',
    responsible_person_name: link?.responsible_person_name || capa?.action_owner_name || '',
    target_completion_date: link?.target_completion_date || capa?.target_completion_date || record.target_closure_date || today(),
    effectiveness_check_required: link?.effectiveness_check_required ?? capa?.effectiveness_check_required ?? true,
    remarks: link?.remarks || '',
  };
}

export { computeCapaLinkAutoRules, computeCapaMandatory, isCapaLinkOverdue, mapCapaRecordToDisplayStatus };
