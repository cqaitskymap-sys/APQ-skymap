import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import {
  CPV_COLLECTIONS,
  CppRecord,
  CqaRecord,
  RiskRecord,
} from './cpv';
import { listCpvRecords } from './cpv-service';
import {
  AnnualCpvDocument,
  AnnualCpvSignature,
  AnnualCpvSnapshot,
  AnnualCpvWorkflowStatus,
  DEFAULT_ANNUAL_CPV_SIGNATURES,
  buildAnnualCpvSnapshot,
  generateAnnualCpvNumber,
} from './cpv-annual-review';

type Actor = { id?: string; name?: string; role?: string };

async function readFirstAvailable(candidates: string[], max = 500): Promise<Record<string, unknown>[]> {
  for (const name of candidates) {
    try {
      const snap = await getDocs(query(collection(firestore, name), limit(max)));
      if (!snap.empty) return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch { /* try next */ }
  }
  return [];
}

const MOCK_EQUIPMENT = [
  { id: 'eq-1', equipment_id: 'FIL-001', name: 'Filling Machine A', status: 'qualified', qualification_date: '2025-06-01' },
  { id: 'eq-2', equipment_id: 'AUT-001', name: 'Autoclave Unit 1', status: 'qualified', qualification_date: '2025-08-15' },
  { id: 'eq-3', equipment_id: 'SPEC-001', name: 'UV Spectrophotometer', status: 'qualified', qualification_date: '2025-11-20' },
];

export async function loadAnnualReviewSourceData(year: number, productFilter = 'all') {
  const [cpp, cqa, risks, deviations, oos, capa, changeControl, batches, equipmentRaw] = await Promise.all([
    listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp),
    listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa),
    listCpvRecords<RiskRecord>(CPV_COLLECTIONS.risk),
    readFirstAvailable(['deviations']),
    readFirstAvailable(['oos_records', 'oos']),
    readFirstAvailable(['capa_records', 'capa']),
    readFirstAvailable(['change_control', 'change_controls']),
    readFirstAvailable(['batches', 'pqr_batches']),
    readFirstAvailable(['equipment', 'equipment_qualification', 'equipment_records']),
  ]);

  const equipment = equipmentRaw.length ? equipmentRaw : MOCK_EQUIPMENT;

  const snapshot = buildAnnualCpvSnapshot({
    year,
    productFilter,
    cpp,
    cqa,
    risks,
    deviations,
    oos,
    capa,
    changeControl,
    batches,
    equipment,
  });

  return { snapshot, raw: { cpp, cqa, risks, deviations, oos, capa, changeControl, batches, equipment } };
}

export async function listAnnualCpvDocuments(): Promise<AnnualCpvDocument[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, CPV_COLLECTIONS.annualReview),
      orderBy('createdAt', 'desc'),
      limit(100),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AnnualCpvDocument));
  } catch {
    return [];
  }
}

export async function getAnnualCpvDocumentsByYear(year: number): Promise<AnnualCpvDocument[]> {
  const docs = await listAnnualCpvDocuments();
  return docs.filter((d) => d.reviewYear === year);
}

export async function saveAnnualCpvDraft(
  input: {
    reviewYear: number;
    productName?: string;
    snapshot: AnnualCpvSnapshot;
    conclusion?: string;
    recommendations?: string;
    existingId?: string;
  },
  actor: Actor,
): Promise<AnnualCpvDocument> {
  const now = new Date().toISOString();
  const existing = await getAnnualCpvDocumentsByYear(input.reviewYear);
  const docNumber = generateAnnualCpvNumber(input.reviewYear, existing.length);

  const payload: Omit<AnnualCpvDocument, 'id'> = {
    documentNumber: docNumber,
    reviewYear: input.reviewYear,
    productName: input.productName || 'All Products',
    status: 'draft',
    conclusion: input.conclusion || input.snapshot.conclusion,
    recommendations: input.recommendations || input.snapshot.recommendations,
    preparedBy: actor.name || 'System',
    preparedById: actor.id || 'system',
    signatures: DEFAULT_ANNUAL_CPV_SIGNATURES.map((s, i) => ({
      ...s,
      name: i === 0 ? (actor.name || '') : s.name,
      signatureText: i === 0 ? (actor.name || '') : '',
      signedAt: i === 0 ? now : null,
    })),
    snapshot: input.snapshot,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  if (input.existingId) {
    const existingDoc = await getDoc(doc(firestore, CPV_COLLECTIONS.annualReview, input.existingId));
    const prev = existingDoc.exists() ? (existingDoc.data() as AnnualCpvDocument) : null;
    const updatePayload = {
      conclusion: input.conclusion || input.snapshot.conclusion,
      recommendations: input.recommendations || input.snapshot.recommendations,
      snapshot: input.snapshot,
      productName: input.productName || prev?.productName || 'All Products',
      updatedAt: now,
      version: (prev?.version || 1) + 1,
    };
    await updateDoc(doc(firestore, CPV_COLLECTIONS.annualReview, input.existingId), updatePayload);
    return { ...prev, id: input.existingId, ...updatePayload } as AnnualCpvDocument;
  }

  const ref = await addDoc(collection(firestore, CPV_COLLECTIONS.annualReview), payload);
  return { id: ref.id, ...payload };
}

export async function updateAnnualCpvWorkflow(
  documentId: string,
  status: AnnualCpvWorkflowStatus,
  updates?: Partial<Pick<AnnualCpvDocument, 'conclusion' | 'recommendations' | 'snapshot'>>,
) {
  await updateDoc(doc(firestore, CPV_COLLECTIONS.annualReview, documentId), {
    status,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function signAnnualCpv(
  documentId: string,
  role: AnnualCpvSignature['role'],
  payload: { name: string; signatureText: string; meaning: string; reason: string; userId?: string },
) {
  const docSnap = await getDoc(doc(firestore, CPV_COLLECTIONS.annualReview, documentId));
  if (!docSnap.exists()) throw new Error('Document not found');
  const data = docSnap.data() as AnnualCpvDocument;
  const signatures = (data.signatures || DEFAULT_ANNUAL_CPV_SIGNATURES).map((s) =>
    s.role === role
      ? {
        ...s,
        name: payload.name,
        signatureText: payload.signatureText,
        meaning: payload.meaning,
        reason: payload.reason,
        userId: payload.userId,
        signedAt: new Date().toISOString(),
      }
      : s,
  );

  let status: AnnualCpvWorkflowStatus = data.status;
  if (role === 'reviewed' && status === 'draft') status = 'under_review';
  if (role === 'approved') status = 'approved';

  await updateDoc(doc(firestore, CPV_COLLECTIONS.annualReview, documentId), {
    signatures,
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function archiveAnnualCpv(documentId: string) {
  await updateAnnualCpvWorkflow(documentId, 'archived');
}
