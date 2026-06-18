import {
  addDoc, collection, doc, getDocs, limit, query, updateDoc, where, orderBy,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { CAPA_COLLECTIONS, type CapaRecord } from '@/lib/capa-types';
import { createCapa, getCapaById, getCapaEffectiveness } from '@/lib/capa-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  capaLinkFromCapaRecord,
  COMPLAINT_CAPA_MODULE,
  computeComplaintCapaLinkAutoRules,
  computeComplaintCapaMandatory,
  isComplaintCapaLinkOverdue,
  mapCapaRecordToComplaintDisplayStatus,
  type ComplaintCapaLinkActor,
  type ComplaintCapaLinkFormInput,
} from '@/lib/complaint-capa-records';
import type { ComplaintCapaImplementationInput } from '@/lib/complaint-capa-schemas';
import { getComplaintImpactAssessment } from '@/lib/complaint-impact-service';
import {
  COMPLAINT_COLLECTIONS,
  type ComplaintCapaLink,
  type ComplaintRecord,
} from '@/lib/complaint-types';
import {
  getAuditLogsForComplaint,
  getComplaintById,
  listComplaints,
  updateComplaint,
} from '@/lib/complaint-service';

export type { ComplaintCapaLinkActor, ComplaintCapaLinkFormInput };

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

async function audit(actor: ComplaintCapaLinkActor, actionType: string, complaintId: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: COMPLAINT_CAPA_MODULE,
      collectionName: COMPLAINT_COLLECTIONS.capaLinks,
      recordId: complaintId,
      actionType,
      actionDescription: detail || actionType,
      reason: detail || '',
      user: { id: actor.id, name: actor.name, role: actor.role || '', department: actor.department },
      status: 'Success',
    });
  } catch (e) {
    console.error('complaint capa audit', e);
  }
}

async function notify(title: string, message: string, complaintId: string, roles: string[]) {
  if (!isFirebaseConfigured()) return;
  for (const role of roles) {
    try {
      await addDoc(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.notifications), {
        title, message, module: 'Complaint', record_id: complaintId, target_role: role, read: false, created_at: nowIso(),
      });
    } catch (e) {
      console.error('complaint capa notify', e);
    }
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

export async function getActiveComplaintCapaLink(complaintId: string): Promise<ComplaintCapaLink | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.capaLinks),
      where('complaint_id', '==', complaintId),
      where('is_active', '==', true),
      limit(1),
    ));
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as ComplaintCapaLink;
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.capaLinks),
      where('complaint_id', '==', complaintId),
      limit(5),
    ));
    const active = snap.docs.find((d) => d.data().is_active !== false);
    if (!active) return null;
    return { id: active.id, ...active.data() } as ComplaintCapaLink;
  }
}

export async function getComplaintCapaLinkHistory(complaintId: string): Promise<ComplaintCapaLink[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.capaLinks),
      where('complaint_id', '==', complaintId),
      orderBy('created_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ComplaintCapaLink));
  } catch {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.capaLinks),
      where('complaint_id', '==', complaintId),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ComplaintCapaLink))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

async function syncComplaintCapaStatus(
  complaintId: string,
  capaRequired: boolean,
  capa: CapaRecord | null,
  actor: ComplaintCapaLinkActor,
) {
  const patch: Partial<ComplaintRecord> = {
    capa_required: capaRequired,
    linked_capa_number: capa?.capa_number || null,
    linked_capa_id: capa?.id || null,
  };
  if (capaRequired && capa) {
    const displayStatus = mapCapaRecordToComplaintDisplayStatus(capa.capa_status, capa.target_completion_date);
    if (!['Closed'].includes(displayStatus)) patch.status = 'capa_required';
  }
  await updateComplaint(complaintId, patch, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
}

async function writeComplaintCapaLink(
  payload: Omit<ComplaintCapaLink, 'id'>,
  actor: ComplaintCapaLinkActor,
  action: string,
): Promise<ComplaintCapaLink> {
  const ref = await addDoc(collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.capaLinks), payload);
  await audit(actor, action, payload.complaint_id, `${payload.capa_number}: ${action}`);
  return { id: ref.id, ...payload };
}

async function deactivateExistingComplaintLinks(complaintId: string, actor: ComplaintCapaLinkActor) {
  const history = await getComplaintCapaLinkHistory(complaintId);
  await Promise.all(history.filter((h) => h.is_active).map(async (h) => {
    await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.capaLinks, h.id), {
      is_active: false,
      updated_at: nowIso(),
      updated_by: actor.id,
      updated_by_name: actor.name,
    });
  }));
}

export async function fetchComplaintCapaPageData(complaintId: string) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const [record, impact] = await Promise.all([
      getComplaintById(complaintId),
      getComplaintImpactAssessment(complaintId),
    ]);
    if (!record) return { error: 'Complaint not found.' };
    const link = await getActiveComplaintCapaLink(complaintId);
    let capa: CapaRecord | null = null;
    if (link?.capa_id) capa = await getCapaById(link.capa_id);
    else if (record.linked_capa_id) capa = await getCapaById(record.linked_capa_id);
    const history = await getComplaintCapaLinkHistory(complaintId);
    const effectiveness = capa ? await getCapaEffectiveness(capa.id) : null;
    return {
      record,
      impact,
      link: link ? {
        ...link,
        capa_status: mapCapaRecordToComplaintDisplayStatus(capa?.capa_status, capa?.target_completion_date) || link.capa_status,
      } : null,
      capa,
      history,
      effectiveness: effectiveness ? [effectiveness] : [],
      autoRules: computeComplaintCapaLinkAutoRules(record, impact),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load CAPA link data' };
  }
}

export async function listComplaintCapaLinks(max = 100): Promise<(ComplaintRecord & { link?: ComplaintCapaLink | null })[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const records = (await listComplaints())
      .filter((r) => r.status !== 'draft' && (r.capa_required || r.linked_capa_number));
    return Promise.all(records.slice(0, max).map(async (r) => {
      const impact = await getComplaintImpactAssessment(r.id);
      const mandatory = computeComplaintCapaMandatory(r, impact);
      if (!mandatory && !r.linked_capa_number && !r.capa_required) return null;
      return { ...r, link: await getActiveComplaintCapaLink(r.id) };
    })).then((rows) => rows.filter(Boolean) as (ComplaintRecord & { link?: ComplaintCapaLink | null })[]);
  } catch (e) {
    console.error('listComplaintCapaLinks', e);
    return [];
  }
}

export async function saveComplaintCapaRequirement(
  complaintId: string,
  capaRequired: boolean,
  remarks: string,
  actor: ComplaintCapaLinkActor,
): Promise<{ error?: string }> {
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };
  const impact = await getComplaintImpactAssessment(complaintId);
  const mandatory = computeComplaintCapaMandatory(record, impact);
  if (mandatory && !capaRequired) return { error: 'CAPA is mandatory for this complaint and cannot be set to No.' };

  try {
    await updateComplaint(complaintId, {
      capa_required: capaRequired || mandatory,
      ...(capaRequired || mandatory ? { status: 'capa_required' } : {}),
    }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
    await audit(actor, 'CAPA Required Changed', complaintId, capaRequired ? 'CAPA required' : 'CAPA not required');
    if (remarks.trim()) await audit(actor, 'CAPA Requirement Remarks', complaintId, remarks);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to save CAPA requirement' };
  }
}

export async function linkExistingCapaToComplaint(
  complaintId: string,
  capaNumber: string,
  remarks: string,
  actor: ComplaintCapaLinkActor,
): Promise<{ link?: ComplaintCapaLink; error?: string }> {
  if (!complaintId) return { error: 'Complaint ID is required.' };
  if (!capaNumber.trim()) return { error: 'CAPA number is required' };
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };

  const capa = await findCapaByNumber(capaNumber);
  if (!capa) return { error: `CAPA ${capaNumber} not found` };

  try {
    await deactivateExistingComplaintLinks(complaintId, actor);
    const impact = await getComplaintImpactAssessment(complaintId);
    const capaRequired = record.capa_required || computeComplaintCapaMandatory(record, impact);
    const payload = capaLinkFromCapaRecord(
      complaintId, record.complaint_number, capa, capaRequired, actor, remarks, capa.department || 'QA',
    );
    const link = await writeComplaintCapaLink(payload, actor, 'CAPA Linked');

    await updateDoc(doc(getFirebaseFirestore(), CAPA_COLLECTIONS.records, capa.id), {
      complaint_id: complaintId,
      updated_at: nowIso(),
    });

    await syncComplaintCapaStatus(complaintId, capaRequired, capa, actor);
    await notify('CAPA Linked to Complaint', `${capa.capa_number} linked to ${record.complaint_number}`, complaintId, ['qa', 'qa_manager']);
    if (capa.action_owner) {
      await notify('CAPA Assigned from Complaint', `${capa.capa_number} linked to complaint ${record.complaint_number}`, complaintId, ['qa']);
    }
    return { link };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to link CAPA' };
  }
}

export async function createComplaintCapaLink(
  complaintId: string,
  input: ComplaintCapaLinkFormInput,
  actor: ComplaintCapaLinkActor,
): Promise<{ link?: ComplaintCapaLink; capa?: CapaRecord; error?: string }> {
  if (!complaintId) return { error: 'Complaint ID is required.' };
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };
  const impact = await getComplaintImpactAssessment(complaintId);
  const capaRequired = input.capa_required || computeComplaintCapaMandatory(record, impact);

  if (capaRequired && !input.capa_title?.trim()) return { error: 'CAPA title is required when CAPA is required.' };
  if (capaRequired && !input.corrective_action.trim()) return { error: 'Corrective action is required' };
  if (capaRequired && !input.preventive_action.trim()) return { error: 'Preventive action is required' };
  if (capaRequired && !input.action_owner_name.trim()) return { error: 'Action owner is required' };
  if (capaRequired && !input.target_completion_date) return { error: 'Target completion date is required' };

  try {
    const capa = await createCapa({
      capa_date: today(),
      capa_source: input.capa_source || 'Market Complaint',
      source_reference_number: record.complaint_number,
      department: input.department || 'QA',
      product_name: record.product_name,
      batch_number: record.batch_number,
      capa_title: input.capa_title || `CAPA for ${record.complaint_number}`,
      problem_description: record.complaint_description,
      root_cause: input.root_cause || record.root_cause || impact?.conclusion || '',
      corrective_action: input.corrective_action,
      preventive_action: input.preventive_action,
      action_owner: actor.id,
      action_owner_name: input.action_owner_name,
      target_completion_date: input.target_completion_date,
      effectiveness_check_required: input.effectiveness_check_required,
      effectiveness_criteria: 'No repeat complaint for same root cause within 12 months',
      priority: record.complaint_criticality === 'Critical' ? 'critical' : record.complaint_criticality === 'Major' ? 'high' : 'medium',
      qa_remarks: input.remarks || '',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' }, { status: 'submitted' });

    await updateDoc(doc(getFirebaseFirestore(), CAPA_COLLECTIONS.records, capa.id), {
      complaint_id: complaintId,
      updated_at: nowIso(),
    });

    await deactivateExistingComplaintLinks(complaintId, actor);
    const payload = capaLinkFromCapaRecord(
      complaintId, record.complaint_number, capa, capaRequired, actor, input.remarks || '', input.department || 'QA',
    );
    const link = await writeComplaintCapaLink(payload, actor, 'CAPA Created');
    await syncComplaintCapaStatus(complaintId, capaRequired, capa, actor);
    await audit(actor, 'CAPA Created', complaintId, capa.capa_number);
    await notify('CAPA Created from Complaint', `${capa.capa_number} created for ${record.complaint_number}`, complaintId, ['qa_manager', 'head_qa']);
    return { link, capa };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to create CAPA' };
  }
}

export async function unlinkCapaFromComplaint(
  complaintId: string,
  reason: string,
  actor: ComplaintCapaLinkActor,
): Promise<{ error?: string }> {
  if (!reason.trim()) return { error: 'Unlink reason is required' };
  const link = await getActiveComplaintCapaLink(complaintId);
  const record = await getComplaintById(complaintId);
  if (!record) return { error: 'Complaint not found' };

  try {
    if (link) {
      await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.capaLinks, link.id), {
        is_active: false,
        unlink_reason: reason,
        unlinked_at: nowIso(),
        unlinked_by: actor.id,
        unlinked_by_name: actor.name,
        updated_at: nowIso(),
      });
    }
    await updateComplaint(complaintId, {
      linked_capa_number: null,
      linked_capa_id: null,
    }, { id: actor.id, name: actor.name, role: actor.role || '' }, true);
    await audit(actor, 'CAPA Unlinked', complaintId, reason);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to unlink CAPA' };
  }
}

export async function refreshComplaintCapaLinkStatus(complaintId: string, actor: ComplaintCapaLinkActor): Promise<void> {
  const link = await getActiveComplaintCapaLink(complaintId);
  if (!link?.capa_id) return;
  const capa = await getCapaById(link.capa_id);
  if (!capa) return;
  const displayStatus = mapCapaRecordToComplaintDisplayStatus(capa.capa_status, capa.target_completion_date);
  const wasOverdue = link.capa_status === 'Overdue';
  await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.capaLinks, link.id), {
    capa_status: displayStatus,
    implementation_date: capa.actual_completion_date || link.implementation_date,
    effectiveness_check_date: capa.effectiveness_check_date,
    effectiveness_result: capa.effectiveness_result,
    capa_closure_date: displayStatus === 'Closed' ? today() : link.capa_closure_date,
    corrective_action: capa.corrective_action,
    preventive_action: capa.preventive_action,
    updated_at: nowIso(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  const record = await getComplaintById(complaintId);
  if (record) await syncComplaintCapaStatus(complaintId, record.capa_required, capa, actor);
  if (displayStatus === 'Overdue' && !wasOverdue) {
    await audit(actor, 'CAPA Overdue', complaintId, capa.capa_number);
    await notify('CAPA Overdue — Complaint', `CAPA ${capa.capa_number} is overdue for complaint ${record?.complaint_number}`, complaintId, ['qa_manager', 'head_qa', 'qa']);
  }
}

const STATUS_MAP: Record<string, string> = {
  Draft: 'draft',
  Open: 'submitted',
  'Under Implementation': 'under_implementation',
  'Pending Verification': 'pending_verification',
  'Effectiveness Check Pending': 'effectiveness_pending',
  Closed: 'closed',
  Overdue: 'overdue',
};

export async function updateLinkedComplaintCapaStatus(
  complaintId: string,
  newStatus: string,
  actor: ComplaintCapaLinkActor,
): Promise<{ error?: string }> {
  const link = await getActiveComplaintCapaLink(complaintId);
  if (!link?.capa_id) return { error: 'No linked CAPA found' };

  try {
    await updateDoc(doc(getFirebaseFirestore(), CAPA_COLLECTIONS.records, link.capa_id), {
      capa_status: STATUS_MAP[newStatus] || newStatus.toLowerCase(),
      updated_at: nowIso(),
      updated_by: actor.id,
      updated_by_name: actor.name,
    });
    await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.capaLinks, link.id), {
      capa_status: newStatus,
      updated_at: nowIso(),
      updated_by: actor.id,
      updated_by_name: actor.name,
    });
    await audit(actor, 'CAPA Status Update', complaintId, newStatus);
    const capa = await getCapaById(link.capa_id);
    const record = await getComplaintById(complaintId);
    if (record && capa) await syncComplaintCapaStatus(complaintId, record.capa_required, capa, actor);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to update CAPA status' };
  }
}

export async function saveComplaintCapaImplementation(
  complaintId: string,
  input: ComplaintCapaImplementationInput,
  actor: ComplaintCapaLinkActor,
): Promise<{ error?: string }> {
  const link = await getActiveComplaintCapaLink(complaintId);
  if (!link?.capa_id) return { error: 'No linked CAPA found' };

  try {
    const capaPatch: Partial<CapaRecord> = {
      capa_status: STATUS_MAP[input.capa_status] || input.capa_status.toLowerCase(),
      updated_at: nowIso(),
      updated_by: actor.id,
      updated_by_name: actor.name,
    };
    if (input.implementation_date) capaPatch.actual_completion_date = input.implementation_date;
    if (input.corrective_action.trim()) capaPatch.corrective_action = input.corrective_action;
    if (input.preventive_action.trim()) capaPatch.preventive_action = input.preventive_action;

    await updateDoc(doc(getFirebaseFirestore(), CAPA_COLLECTIONS.records, link.capa_id), capaPatch as Record<string, string | null>);
    await updateDoc(doc(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.capaLinks, link.id), {
      capa_status: input.capa_status,
      implementation_date: input.implementation_date || link.implementation_date,
      corrective_action: input.corrective_action || link.corrective_action,
      preventive_action: input.preventive_action || link.preventive_action,
      remarks: input.remarks || link.remarks,
      updated_at: nowIso(),
      updated_by: actor.id,
      updated_by_name: actor.name,
    });
    await audit(actor, 'CAPA Implementation Updated', complaintId, input.capa_status);
    await refreshComplaintCapaLinkStatus(complaintId, actor);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to save implementation' };
  }
}

export function mapComplaintCapaLinkFormDefaults(
  record: ComplaintRecord,
  link?: ComplaintCapaLink | null,
  capa?: CapaRecord | null,
  impact?: import('@/lib/complaint-types').ComplaintImpactAssessment | null,
): ComplaintCapaLinkFormInput {
  return {
    capa_required: link?.capa_required ?? record.capa_required ?? computeComplaintCapaMandatory(record, impact),
    capa_number: link?.capa_number || record.linked_capa_number || '',
    capa_title: link?.capa_title || capa?.capa_title || `CAPA for ${record.complaint_number}`,
    capa_source: link?.capa_source || capa?.capa_source || 'Market Complaint',
    root_cause: link?.root_cause || capa?.root_cause || record.root_cause || impact?.conclusion || '',
    corrective_action: link?.corrective_action || capa?.corrective_action || '',
    preventive_action: link?.preventive_action || capa?.preventive_action || '',
    action_owner_name: link?.action_owner_name || capa?.action_owner_name || '',
    department: link?.department || capa?.department || 'QA',
    target_completion_date: link?.target_completion_date || capa?.target_completion_date || record.due_date || today(),
    effectiveness_check_required: link?.effectiveness_check_required ?? capa?.effectiveness_check_required ?? true,
    remarks: link?.remarks || '',
  };
}

export async function createCapaFromComplaintLegacy(
  complaintId: string,
  actor: ComplaintCapaLinkActor,
): Promise<CapaRecord> {
  const complaint = await getComplaintById(complaintId);
  if (!complaint) throw new Error('Complaint not found');
  if (complaint.linked_capa_id) {
    const existing = await getCapaById(complaint.linked_capa_id);
    if (existing) return existing;
  }
  const activeLink = await getActiveComplaintCapaLink(complaintId);
  if (activeLink?.capa_id) {
    const existing = await getCapaById(activeLink.capa_id);
    if (existing) return existing;
  }
  const result = await createComplaintCapaLink(complaintId, {
    capa_required: true,
    capa_title: `CAPA from Complaint ${complaint.complaint_number}`,
    capa_source: 'Market Complaint',
    root_cause: '',
    corrective_action: 'TBD — to be defined during CAPA planning',
    preventive_action: 'TBD — to be defined during CAPA planning',
    action_owner_name: actor.name,
    department: 'QA',
    target_completion_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    effectiveness_check_required: true,
    remarks: 'Auto-created from complaint workflow',
  }, actor);
  if (result.error || !result.capa) throw new Error(result.error || 'Failed to create CAPA');
  return result.capa;
}

export {
  computeComplaintCapaLinkAutoRules,
  computeComplaintCapaMandatory,
  isComplaintCapaLinkOverdue,
  mapCapaRecordToComplaintDisplayStatus,
  canCloseComplaintWithCapa,
  isComplaintCapaSatisfiedForClosure,
} from '@/lib/complaint-capa-records';

export { getAuditLogsForComplaint };
