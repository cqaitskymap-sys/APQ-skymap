import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseFirestore, getFirebaseStorage } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { isVendorSelectable } from '@/lib/vendor-mgmt-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  WAREHOUSE_COLLECTIONS, calcExpiryStatus, calcRetestStatus, isMaterialUsable,
  type MaterialReceipt, type QcSampling, type MaterialRelease, type MaterialDispensing,
  type InventoryStock, type FinishedGoods, type TraceabilityRecord,
  type WarehouseFilters, type WarehouseDashboardMetrics, type WarehouseActor,
} from './warehouse-mgmt-types';
import type {
  ReceiptInput, SamplingInput, ReleaseInput, DispensingInput, FinishedGoodsInput,
} from './warehouse-mgmt-schemas';

function now() { return new Date().toISOString(); }
function today() { return now().split('T')[0]; }

async function auditLog(actor: WarehouseActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Warehouse', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.notifications), {
        title, message, module: 'Warehouse', record_id: recordId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Notification failed:', e); }
}

async function genNumber(prefix: string, collName: string, field: string): Promise<string> {
  const year = new Date().getFullYear();
  const p = `${prefix}-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), collName),
      where(field, '>=', p), where(field, '<=', `${p}\uf8ff`),
      orderBy(field, 'desc'), limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data()[field] as string;
      return `${p}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), collName));
    return `${p}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${p}0001`;
}

async function upsertTraceability(
  arNumber: string, lotNumber: string, materialName: string, materialType: string,
  grnNumber: string, vendorName: string,
  step: { step: string; ref_id: string; ref_no: string; date: string; quantity: number },
  extras?: { production_batch?: string; fg_batch_number?: string; dispatch_ref?: string },
) {
  const q = query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.traceability), where('ar_number', '==', arNumber), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) {
    await addDoc(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.traceability), {
      ar_number: arNumber, lot_number: lotNumber, material_name: materialName,
      material_type: materialType, grn_number: grnNumber, vendor_name: vendorName,
      production_batch: extras?.production_batch || null,
      fg_batch_number: extras?.fg_batch_number || null,
      dispatch_ref: extras?.dispatch_ref || null,
      chain: [step], updated_at: now(),
    });
  } else {
    const d = snap.docs[0];
    const data = d.data() as TraceabilityRecord;
    const chain = [...(data.chain || []), step];
    await updateDoc(d.ref, {
      chain, updated_at: now(),
      ...(extras?.production_batch ? { production_batch: extras.production_batch } : {}),
      ...(extras?.fg_batch_number ? { fg_batch_number: extras.fg_batch_number } : {}),
      ...(extras?.dispatch_ref ? { dispatch_ref: extras.dispatch_ref } : {}),
    });
  }
}

// ─── Material Receipt ────────────────────────────────────────────────────────

export async function createReceipt(input: ReceiptInput, actor: WarehouseActor): Promise<MaterialReceipt> {
  const grnNumber = await genNumber('GRN', WAREHOUSE_COLLECTIONS.receipts, 'grn_number');
  const arNumber = await genNumber('AR', WAREHOUSE_COLLECTIONS.receipts, 'ar_number');

  let status = 'Quarantine';
  if (input.vendor_doc_id) {
    const approved = await isVendorSelectable(input.vendor_doc_id);
    if (!approved) {
      status = 'Blocked';
      await notify('Vendor Blocked', `Receipt blocked — vendor ${input.vendor_name} not approved`, grnNumber, ['qa_manager', 'warehouse_manager']);
    }
  }

  const timestamp = now();
  const record: Omit<MaterialReceipt, 'id'> = {
    grn_number: grnNumber,
    receipt_date: input.receipt_date,
    material_type: input.material_type,
    material_code: input.material_code,
    material_name: input.material_name,
    vendor_doc_id: input.vendor_doc_id || null,
    vendor_name: input.vendor_name,
    manufacturer_name: input.manufacturer_name,
    supplier_name: input.supplier_name,
    invoice_number: input.invoice_number,
    po_number: input.po_number,
    ar_number: arNumber,
    batch_lot_number: input.batch_lot_number,
    mfg_date: input.mfg_date || null,
    exp_date: input.exp_date || null,
    retest_date: input.retest_date || null,
    received_quantity: input.received_quantity,
    unit: input.unit,
    container_count: input.container_count,
    storage_condition: input.storage_condition,
    coa_available: input.coa_available,
    status,
    qc_status: 'Pending',
    remarks: input.remarks,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_at: timestamp,
    created_at: timestamp,
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.receipts), record);
  const full = { id: refDoc.id, ...record };
  await auditLog(actor, 'RECEIPT', refDoc.id, null, record);

  const expStatus = calcExpiryStatus(input.exp_date || null);
  const retestStatus = calcRetestStatus(input.retest_date || null);
  if (retestStatus === 'Retest Due') {
    await notify('Retest Due Alert', `${input.material_name} AR ${arNumber} retest due`, refDoc.id, ['qc_manager', 'qa_manager']);
  }

  await addDoc(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.inventory), {
    material_name: input.material_name, material_code: input.material_code,
    material_type: input.material_type, ar_number: arNumber, lot_number: input.batch_lot_number,
    grn_number: grnNumber, receipt_doc_id: refDoc.id,
    available_quantity: status === 'Blocked' ? 0 : 0,
    reserved_quantity: status === 'Blocked' ? 0 : input.received_quantity,
    consumed_quantity: 0, rejected_quantity: 0,
    storage_location: 'Quarantine Zone',
    exp_date: input.exp_date || null, retest_date: input.retest_date || null,
    expiry_status: expStatus, retest_status: retestStatus,
    qc_status: 'Pending', receipt_status: status, unit: input.unit, updated_at: timestamp,
  });

  await upsertTraceability(arNumber, input.batch_lot_number, input.material_name, input.material_type, grnNumber, input.vendor_name, {
    step: 'Receipt', ref_id: refDoc.id, ref_no: grnNumber, date: input.receipt_date, quantity: input.received_quantity,
  });

  return full;
}

export async function listReceipts(filters?: WarehouseFilters): Promise<MaterialReceipt[]> {
  const constraints: QueryConstraint[] = [orderBy('created_at', 'desc')];
  if (filters?.material_type) constraints.unshift(where('material_type', '==', filters.material_type));
  if (filters?.status) constraints.unshift(where('status', '==', filters.status));
  const snap = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.receipts), ...constraints));
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MaterialReceipt));
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter((r) =>
      r.grn_number.toLowerCase().includes(s) || r.ar_number.toLowerCase().includes(s)
      || r.material_name.toLowerCase().includes(s) || r.vendor_name.toLowerCase().includes(s),
    );
  }
  return rows;
}

export async function getReceiptById(id: string): Promise<MaterialReceipt | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.receipts, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MaterialReceipt;
}

// ─── QC Sampling ─────────────────────────────────────────────────────────────

export async function createSampling(input: SamplingInput, actor: WarehouseActor): Promise<QcSampling> {
  const samplingNo = await genNumber('SMP', WAREHOUSE_COLLECTIONS.sampling, 'sampling_number');
  const record: Omit<QcSampling, 'id'> = {
    sampling_number: samplingNo,
    grn_number: input.grn_number,
    receipt_doc_id: input.receipt_doc_id,
    material_name: input.material_name,
    ar_number: input.ar_number,
    sample_quantity: input.sample_quantity,
    sampled_by: actor.id,
    sampled_by_name: actor.name,
    sampling_date: input.sampling_date,
    qc_status: input.qc_status,
    remarks: input.remarks,
    created_at: now(),
  };
  const refDoc = await addDoc(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.sampling), record);
  await auditLog(actor, 'SAMPLING', refDoc.id, null, record);

  const receiptStatus = input.qc_status === 'Under Test' ? 'Under Test' : 'Under Sampling';
  await updateDoc(doc(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.receipts, input.receipt_doc_id), {
    status: receiptStatus, qc_status: input.qc_status, updated_at: now(),
  });

  const invSnap = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.inventory), where('ar_number', '==', input.ar_number), limit(1)));
  if (!invSnap.empty) {
    await updateDoc(invSnap.docs[0].ref, { qc_status: input.qc_status, receipt_status: receiptStatus, updated_at: now() });
  }

  return { id: refDoc.id, ...record };
}

export async function listSamplings(): Promise<QcSampling[]> {
  const snap = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.sampling), orderBy('sampling_date', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as QcSampling));
}

// ─── Material Release ────────────────────────────────────────────────────────

export async function createRelease(input: ReleaseInput, actor: WarehouseActor): Promise<MaterialRelease> {
  const releaseNo = await genNumber('REL', WAREHOUSE_COLLECTIONS.release, 'release_number');
  const record: Omit<MaterialRelease, 'id'> = {
    release_number: releaseNo,
    grn_number: input.grn_number,
    receipt_doc_id: input.receipt_doc_id,
    ar_number: input.ar_number,
    qc_result: input.qc_result,
    released_quantity: input.released_quantity,
    rejected_quantity: input.rejected_quantity,
    approved_by: actor.id,
    approved_by_name: actor.name,
    release_date: input.release_date,
    status: input.status,
    remarks: input.remarks,
    created_at: now(),
  };
  const refDoc = await addDoc(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.release), record);
  await auditLog(actor, 'RELEASE', refDoc.id, null, record);

  const receiptStatus = input.qc_result === 'Approved' ? 'Approved' : 'Rejected';
  await updateDoc(doc(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.receipts, input.receipt_doc_id), {
    status: receiptStatus, qc_status: input.qc_result, updated_at: now(),
  });

  const invSnap = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.inventory), where('ar_number', '==', input.ar_number), limit(1)));
  if (!invSnap.empty) {
    const inv = invSnap.docs[0];
    const data = inv.data() as InventoryStock;
    await updateDoc(inv.ref, {
      available_quantity: input.qc_result === 'Approved' ? input.released_quantity : 0,
      reserved_quantity: Math.max(0, data.reserved_quantity - input.released_quantity - input.rejected_quantity),
      rejected_quantity: input.rejected_quantity,
      qc_status: input.qc_result,
      receipt_status: receiptStatus,
      storage_location: input.qc_result === 'Approved' ? 'Approved Storage' : 'Rejected Zone',
      updated_at: now(),
    });
  }

  await upsertTraceability(input.ar_number, '', '', '', input.grn_number, '', {
    step: 'Release', ref_id: refDoc.id, ref_no: releaseNo, date: input.release_date, quantity: input.released_quantity,
  });

  return { id: refDoc.id, ...record };
}

export async function listReleases(): Promise<MaterialRelease[]> {
  const snap = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.release), orderBy('release_date', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MaterialRelease));
}

// ─── Material Dispensing ─────────────────────────────────────────────────────

export async function suggestFifoLots(materialCode: string): Promise<InventoryStock[]> {
  const snap = await getDocs(query(
    collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.inventory),
    where('material_code', '==', materialCode),
    orderBy('exp_date', 'asc'),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryStock))
    .filter(isMaterialUsable);
}

export async function createDispensing(input: DispensingInput, actor: WarehouseActor): Promise<MaterialDispensing> {
  const invSnap = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.inventory), where('ar_number', '==', input.ar_number), limit(1)));
  if (invSnap.empty) throw new Error('Inventory not found for AR number');

  const stock = { id: invSnap.docs[0].id, ...invSnap.docs[0].data() } as InventoryStock;

  if (!isMaterialUsable(stock)) {
    throw new Error('Material not approved for use — QC approval required');
  }
  if (stock.expiry_status === 'Expired') {
    throw new Error('Material expired — dispensing blocked');
  }
  if (input.dispensed_quantity > stock.available_quantity) {
    throw new Error(`Insufficient stock — available ${stock.available_quantity} ${stock.unit}`);
  }

  const fifo = await suggestFifoLots(input.material_code);
  const fifoSuggested = fifo.length > 0 && fifo[0].ar_number !== input.ar_number ? fifo[0].ar_number : null;

  const dispensingNo = await genNumber('DSP', WAREHOUSE_COLLECTIONS.dispensing, 'dispensing_number');
  const balance = stock.available_quantity - input.dispensed_quantity;

  const record: Omit<MaterialDispensing, 'id'> = {
    dispensing_number: dispensingNo,
    product_name: input.product_name,
    batch_number: input.batch_number,
    material_name: input.material_name,
    material_code: input.material_code,
    ar_number: input.ar_number,
    receipt_doc_id: input.receipt_doc_id,
    required_quantity: input.required_quantity,
    dispensed_quantity: input.dispensed_quantity,
    balance_quantity: balance,
    dispensed_by: actor.id,
    dispensed_by_name: actor.name,
    checked_by: '', checked_by_name: input.checked_by_name,
    qa_verified_by: '', qa_verified_by_name: input.qa_verified_by_name,
    dispensing_date: input.dispensing_date,
    status: 'Dispensed',
    fifo_suggested_ar: fifoSuggested,
    remarks: input.remarks,
    created_at: now(),
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.dispensing), record);
  await auditLog(actor, 'DISPENSING', refDoc.id, null, record);

  await updateDoc(invSnap.docs[0].ref, {
    available_quantity: balance,
    consumed_quantity: stock.consumed_quantity + input.dispensed_quantity,
    updated_at: now(),
  });

  await upsertTraceability(input.ar_number, stock.lot_number, input.material_name, stock.material_type, stock.grn_number, '', {
    step: 'Dispensing', ref_id: refDoc.id, ref_no: dispensingNo, date: input.dispensing_date, quantity: input.dispensed_quantity,
  }, { production_batch: input.batch_number });

  return { id: refDoc.id, ...record };
}

export async function listDispensing(): Promise<MaterialDispensing[]> {
  const snap = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.dispensing), orderBy('dispensing_date', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MaterialDispensing));
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export async function listInventory(filters?: WarehouseFilters): Promise<InventoryStock[]> {
  const snap = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.inventory), orderBy('updated_at', 'desc')));
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryStock));
  if (filters?.material_type) rows = rows.filter((r) => r.material_type === filters.material_type);
  if (filters?.status) rows = rows.filter((r) => r.receipt_status === filters.status);
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter((r) => r.material_name.toLowerCase().includes(s) || r.ar_number.toLowerCase().includes(s));
  }
  return rows;
}

export async function syncInventoryExpiry(): Promise<number> {
  const snap = await getDocs(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.inventory));
  let updated = 0;
  for (const d of snap.docs) {
    const data = d.data() as InventoryStock;
    const expStatus = calcExpiryStatus(data.exp_date);
    const retestStatus = calcRetestStatus(data.retest_date);
    if (expStatus !== data.expiry_status || retestStatus !== data.retest_status) {
      const updates: Partial<InventoryStock> = { expiry_status: expStatus, retest_status: retestStatus, updated_at: now() };
      if (expStatus === 'Expired') updates.receipt_status = 'Expired';
      await updateDoc(d.ref, updates);
      updated++;
    }
  }
  return updated;
}

// ─── Finished Goods ──────────────────────────────────────────────────────────

export async function createFinishedGoods(input: FinishedGoodsInput, actor: WarehouseActor): Promise<FinishedGoods> {
  const record: Omit<FinishedGoods, 'id'> = {
    fg_batch_number: input.fg_batch_number,
    product_name: input.product_name,
    mfg_date: input.mfg_date,
    exp_date: input.exp_date,
    packed_quantity: input.packed_quantity,
    released_quantity: 0,
    dispatch_quantity: 0,
    balance_quantity: input.packed_quantity,
    customer: input.customer,
    market: input.market,
    status: 'Quarantine',
    source_batch_number: input.source_batch_number,
    remarks: input.remarks,
    created_at: now(),
    updated_at: now(),
  };
  const refDoc = await addDoc(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.finishedGoods), record);
  await auditLog(actor, 'FG_CREATE', refDoc.id, null, record);

  if (input.source_batch_number) {
    const dispSnap = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.dispensing), where('batch_number', '==', input.source_batch_number)));
    for (const d of dispSnap.docs) {
      const disp = d.data() as MaterialDispensing;
      await upsertTraceability(disp.ar_number, '', disp.material_name, '', '', '', {
        step: 'Finished Goods', ref_id: refDoc.id, ref_no: input.fg_batch_number, date: input.mfg_date, quantity: input.packed_quantity,
      }, { production_batch: input.source_batch_number, fg_batch_number: input.fg_batch_number });
    }
  }

  return { id: refDoc.id, ...record };
}

export async function listFinishedGoods(): Promise<FinishedGoods[]> {
  const snap = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.finishedGoods), orderBy('created_at', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinishedGoods));
}

export async function releaseFinishedGoods(id: string, qty: number, actor: WarehouseActor): Promise<FinishedGoods> {
  const snap = await getDoc(doc(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.finishedGoods, id));
  if (!snap.exists()) throw new Error('FG not found');
  const fg = snap.data() as FinishedGoods;
  await updateDoc(snap.ref, {
    released_quantity: qty, status: 'Released', balance_quantity: fg.packed_quantity - qty, updated_at: now(),
  });
  return { ...fg, id: snap.id, released_quantity: qty, status: 'Released', balance_quantity: fg.packed_quantity - qty };
}

// ─── Traceability ────────────────────────────────────────────────────────────

export async function getTraceability(arOrLot: string): Promise<TraceabilityRecord[]> {
  const byAr = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.traceability), where('ar_number', '==', arOrLot)));
  if (!byAr.empty) return byAr.docs.map((d) => ({ id: d.id, ...d.data() } as TraceabilityRecord));
  const byLot = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.traceability), where('lot_number', '==', arOrLot)));
  return byLot.docs.map((d) => ({ id: d.id, ...d.data() } as TraceabilityRecord));
}

export async function getTraceabilityForRecall(lotOrBatch: string): Promise<TraceabilityRecord[]> {
  const results = await getTraceability(lotOrBatch);
  if (results.length) return results;
  const byBatch = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.traceability), where('production_batch', '==', lotOrBatch)));
  if (!byBatch.empty) return byBatch.docs.map((d) => ({ id: d.id, ...d.data() } as TraceabilityRecord));
  const byFg = await getDocs(query(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.traceability), where('fg_batch_number', '==', lotOrBatch)));
  return byFg.docs.map((d) => ({ id: d.id, ...d.data() } as TraceabilityRecord));
}

// ─── Dashboard & Charts ──────────────────────────────────────────────────────

export function computeDashboardMetrics(
  inventory: InventoryStock[],
  receipts: MaterialReceipt[],
  dispensing: MaterialDispensing[],
  finishedGoods: FinishedGoods[],
): WarehouseDashboardMetrics {
  const todayStr = today();
  return {
    totalMaterials: inventory.length,
    quarantineStock: inventory.filter((i) => ['Quarantine', 'Under Sampling', 'Under Test'].includes(i.receipt_status)).reduce((s, i) => s + i.reserved_quantity, 0),
    approvedStock: inventory.filter((i) => i.receipt_status === 'Approved').reduce((s, i) => s + i.available_quantity, 0),
    rejectedStock: inventory.reduce((s, i) => s + i.rejected_quantity, 0),
    expiredStock: inventory.filter((i) => i.expiry_status === 'Expired').length,
    retestDue: inventory.filter((i) => i.retest_status === 'Retest Due').length,
    dispensedToday: dispensing.filter((d) => d.dispensing_date === todayStr).length,
    finishedGoodsStock: finishedGoods.reduce((s, f) => s + f.balance_quantity, 0),
  };
}

export function warehouseChartData(
  inventory: InventoryStock[],
  receipts: MaterialReceipt[],
  dispensing: MaterialDispensing[],
) {
  const byType: Record<string, number> = {};
  const expiryTrend: Record<string, number> = {};
  const vendorTrend: Record<string, number> = {};
  const rejectedTrend: Record<string, number> = {};
  const consumptionTrend: Record<string, number> = {};

  for (const i of inventory) {
    byType[i.material_type] = (byType[i.material_type] || 0) + i.available_quantity + i.reserved_quantity;
    if (i.expiry_status === 'Expired' || i.expiry_status === 'Near Expiry') {
      const m = i.exp_date?.slice(0, 7) || 'Unknown';
      expiryTrend[m] = (expiryTrend[m] || 0) + 1;
    }
    if (i.rejected_quantity > 0) {
      const m = i.updated_at.slice(0, 7);
      rejectedTrend[m] = (rejectedTrend[m] || 0) + i.rejected_quantity;
    }
  }
  for (const r of receipts) {
    const m = r.receipt_date.slice(0, 7);
    vendorTrend[r.vendor_name] = (vendorTrend[r.vendor_name] || 0) + r.received_quantity;
  }
  for (const d of dispensing) {
    const m = d.dispensing_date.slice(0, 7);
    consumptionTrend[m] = (consumptionTrend[m] || 0) + d.dispensed_quantity;
  }

  const toChart = (obj: Record<string, number>) =>
    Object.entries(obj).sort().map(([name, value]) => ({ name, value }));

  return {
    byType: toChart(byType),
    expiryTrend: toChart(expiryTrend),
    vendorTrend: toChart(vendorTrend).slice(0, 10),
    rejectedTrend: toChart(rejectedTrend),
    consumptionTrend: toChart(consumptionTrend),
  };
}

// ─── PQR Integration ─────────────────────────────────────────────────────────

export async function listMaterialsForPqr() {
  const [receipts, inventory, dispensing] = await Promise.all([
    listReceipts(), listInventory(), listDispensing(),
  ]);
  return { receipts, inventory, dispensing };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export async function exportReceiptsCsv(records: MaterialReceipt[]) {
  downloadCsv(
    `receipts-${today()}.csv`,
    ['GRN', 'Date', 'Material', 'Vendor', 'AR No', 'Lot', 'Qty', 'Status'],
    records.map((r) => [r.grn_number, r.receipt_date, r.material_name, r.vendor_name, r.ar_number, r.batch_lot_number, r.received_quantity, r.status]),
  );
}

export async function exportInventoryCsv(records: InventoryStock[]) {
  downloadCsv(
    `inventory-${today()}.csv`,
    ['Material', 'AR No', 'Lot', 'Available', 'Reserved', 'Consumed', 'Location', 'Expiry'],
    records.map((r) => [r.material_name, r.ar_number, r.lot_number, r.available_quantity, r.reserved_quantity, r.consumed_quantity, r.storage_location, r.expiry_status]),
  );
}

export async function exportDispensingCsv(records: MaterialDispensing[]) {
  downloadCsv(
    `dispensing-${today()}.csv`,
    ['No', 'Date', 'Product', 'Batch', 'Material', 'AR', 'Qty', 'Status'],
    records.map((r) => [r.dispensing_number, r.dispensing_date, r.product_name, r.batch_number, r.material_name, r.ar_number, r.dispensed_quantity, r.status]),
  );
}

export async function uploadWarehouseAttachment(
  receiptDocId: string, file: File, category: string, actor: WarehouseActor,
) {
  const path = `warehouse/${receiptDocId}/${Date.now()}_${file.name}`;
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  await addDoc(collection(getFirebaseFirestore(), WAREHOUSE_COLLECTIONS.attachments), {
    receipt_doc_id: receiptDocId, file_name: file.name, file_type: file.type,
    category, storage_path: path, download_url: downloadUrl,
    uploaded_by: actor.id, uploaded_by_name: actor.name, uploaded_at: now(),
  });
}
