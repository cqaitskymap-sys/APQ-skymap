import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  CC_CREATE_MODULE,
  type CcBatchOption,
  type CcCreateActor,
  type CcProductOption,
} from '@/lib/cc-create-records';
import { CC_COLLECTIONS, type ChangeControlRecord } from '@/lib/change-control-types';
import type { ChangeCreateInput } from '@/lib/change-control-schemas';
import {
  createChangeControl,
  generateChangeNumber,
  getChangeById,
  submitChange,
  updateChange,
} from '@/lib/change-control-service';
import { listProducts } from '@/lib/pqr-service';

export type { CcCreateActor };

export async function previewCcNumber(): Promise<string> {
  if (!isFirebaseConfigured()) return `CC/${new Date().getFullYear()}/0001`;
  return generateChangeNumber();
}

export async function fetchCcCreateLookups() {
  try {
    const [products, batches, previewNumber] = await Promise.all([
      fetchCcProducts(),
      fetchCcBatches(),
      previewCcNumber(),
    ]);
    return { products, batches, previewNumber };
  } catch (e) {
    return {
      products: [] as CcProductOption[],
      batches: [] as CcBatchOption[],
      previewNumber: `CC/${new Date().getFullYear()}/0001`,
      error: e instanceof Error ? e.message : 'Failed to load lookups',
    };
  }
}

export async function fetchCcProducts(): Promise<CcProductOption[]> {
  const products = await listProducts();
  return products.map((p) => ({
    id: p.id,
    product_name: p.product_name,
    product_code: p.product_code,
  }));
}

export async function fetchCcBatches(productName?: string): Promise<CcBatchOption[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), CC_COLLECTIONS.batches), limit(200)));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          batch_number: String(data.batch_number || data.batchNumber || ''),
          product_name: String(data.product_name || data.productName || ''),
          pqr_id: (data.pqr_id as string) || null,
        };
      })
      .filter((b) => b.batch_number && (!productName || b.product_name === productName));
  } catch {
    return [];
  }
}

export async function lookupCcBatch(batchNumber: string): Promise<{ batch_id: string | null; pqr_id: string | null; cpv_id?: string | null }> {
  if (!batchNumber || !isFirebaseConfigured()) return { batch_id: null, pqr_id: null };
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CC_COLLECTIONS.batches),
      where('batch_number', '==', batchNumber),
      limit(1),
    ));
    if (snap.empty) return { batch_id: null, pqr_id: null };
    const data = snap.docs[0].data();
    return {
      batch_id: snap.docs[0].id,
      pqr_id: (data.pqr_id as string) || null,
      cpv_id: (data.cpv_id as string) || (data.cpp_id as string) || null,
    };
  } catch {
    return { batch_id: null, pqr_id: null };
  }
}

function toRecordPayload(input: ChangeCreateInput): ChangeCreateInput {
  return {
    ...input,
    risk_assessment_required: input.risk_assessment_required ?? (
      input.change_category === 'Critical' || input.regulatory_impact || input.patient_safety_impact || input.validation_impact
    ),
  };
}

export async function saveCcCreateDraft(
  input: ChangeCreateInput,
  actor: CcCreateActor,
  draftId?: string | null,
): Promise<{ record?: ChangeControlRecord; error?: string }> {
  try {
    const payload = toRecordPayload(input);
    if (draftId) {
      const existing = await getChangeById(draftId);
      if (!existing || existing.status !== 'draft') return { error: 'Draft not found or not editable' };
      const record = await updateChange(draftId, payload as Partial<ChangeControlRecord>, { id: actor.id, name: actor.name, role: actor.role || '' });
      return { record };
    }
    const record = await createChangeControl(payload, { id: actor.id, name: actor.name, role: actor.role || '' });
    return { record };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to save draft' };
  }
}

export async function submitCcChangeControl(
  input: ChangeCreateInput,
  actor: CcCreateActor,
  draftId?: string | null,
): Promise<{ record?: ChangeControlRecord; error?: string }> {
  const saved = await saveCcCreateDraft(input, actor, draftId);
  if (saved.error || !saved.record) return { error: saved.error || 'Failed to save before submit' };
  try {
    const record = await submitChange(saved.record.id, { id: actor.id, name: actor.name, role: actor.role || '' });
    return { record };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to submit change control' };
  }
}

export { CC_CREATE_MODULE };
