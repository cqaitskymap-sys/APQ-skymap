import type { ElectronicSignatureRecord, SignatureKpis, SignatureCharts, SignatureFilters } from './electronic-signatures-types';
import type { EsignRecord } from '@/lib/admin/schemas';

function todayStr() { return new Date().toISOString().split('T')[0]; }

export function mapSignatureRaw(raw: Record<string, unknown> & { id: string }): ElectronicSignatureRecord {
  return {
    id: raw.id,
    signature_id: (raw.signature_id as string) || (raw.esign_record_id as string) || raw.id,
    signature_number: (raw.signature_number as string) || (raw.esign_record_id as string) || `SIG-${raw.id.slice(0, 8)}`,
    entity_type: (raw.entity_type as string) || (raw.module as string) || '',
    entity_id: (raw.entity_id as string) || (raw.record_id as string) || '',
    reference_number: (raw.reference_number as string) || (raw.document_number as string) || '',
    module: (raw.module as string) || (raw.moduleName as string) || '',
    action: (raw.action as string) || (raw.actionType as string) || '',
    signature_meaning: (raw.signature_meaning as string) || (raw.signatureMeaning as string) || '',
    reason: (raw.reason as string) || (raw.reasonComment as string) || '',
    signer_user_id: (raw.signer_user_id as string) || (raw.userId as string) || '',
    signer_name: (raw.signer_name as string) || (raw.userName as string) || '',
    signer_role: (raw.signer_role as string) || (raw.userRole as string) || '',
    department: (raw.department as string) || '',
    email: (raw.email as string) || (raw.userEmail as string) || '',
    signature_method: (raw.signature_method as string) || 'Password Re-authentication',
    authentication_result: (raw.authentication_result as string) || (raw.authenticationStatus as string) || 'Success',
    signed_at: (raw.signed_at as string) || (raw.signedDateTime as string) || '',
    ip_address: (raw.ip_address as string) || (raw.ipAddress as string) || '',
    device_information: (raw.device_information as string) || (raw.deviceInfo as string) || '',
    browser_information: (raw.browser_information as string) || '',
    session_id: (raw.session_id as string) || '',
    hash_value: (raw.hash_value as string) || '',
    status: (raw.status as string) || 'Signed',
    dual_signature_required: Boolean(raw.dual_signature_required),
    dual_signature_completed: Boolean(raw.dual_signature_completed),
    esign_record_id: (raw.esign_record_id as string) || (raw.esignRecordId as string) || '',
    created_at: (raw.created_at as string) || (raw.signed_at as string) || (raw.signedDateTime as string) || '',
  };
}

export function mapEsignRecordToSignature(r: EsignRecord): ElectronicSignatureRecord {
  return mapSignatureRaw({
    id: r.id || r.esignRecordId,
    esign_record_id: r.esignRecordId,
    signature_number: r.esignRecordId,
    entity_id: r.recordId,
    reference_number: r.documentNumber,
    module: r.moduleName,
    action: r.actionType,
    signature_meaning: r.signatureMeaning,
    reason: r.reasonComment,
    signer_user_id: r.userId,
    signer_name: r.userName,
    signer_role: r.userRole,
    department: r.department,
    email: r.userEmail,
    authentication_result: r.authenticationStatus,
    signed_at: r.signedDateTime,
    ip_address: r.ipAddress,
    device_information: r.deviceInfo,
    status: r.status,
    created_at: r.signedDateTime,
  });
}

export function emptySignatureKpis(): SignatureKpis {
  return {
    totalSignatures: 0, todaysSignatures: 0, pendingSignatures: 0, failedAttempts: 0,
    documentSignatures: 0, trainingSignatures: 0, approvalSignatures: 0, dualSignatures: 0,
  };
}

export function emptySignatureCharts(): SignatureCharts {
  return { dailyTrend: [], moduleWise: [], meaningDistribution: [], failedAuthTrend: [], userActivity: [] };
}

export function computeSignatureKpis(records: ElectronicSignatureRecord[]): SignatureKpis {
  const today = todayStr();
  const signed = records.filter((r) => r.status !== 'Failed' && r.status !== 'Test');
  return {
    totalSignatures: signed.length,
    todaysSignatures: records.filter((r) => r.signed_at?.startsWith(today) && r.status === 'Signed').length,
    pendingSignatures: records.filter((r) => ['Pending', 'Dual Pending'].includes(r.status)).length,
    failedAttempts: records.filter((r) => r.authentication_result === 'Failed' || r.status === 'Failed').length,
    documentSignatures: records.filter((r) => /document|dms/i.test(r.module)).length,
    trainingSignatures: records.filter((r) => /training/i.test(r.module)).length,
    approvalSignatures: records.filter((r) => /approval|capa|deviation|oos|change|risk|validation|pqr/i.test(r.module)).length,
    dualSignatures: records.filter((r) => r.dual_signature_required).length,
  };
}

export function computeSignatureCharts(records: ElectronicSignatureRecord[]): SignatureCharts {
  const byDate = new Map<string, number>();
  const byModule = new Map<string, number>();
  const byMeaning = new Map<string, number>();
  const failedByDate = new Map<string, number>();
  const byUser = new Map<string, number>();

  for (const r of records) {
    const d = r.signed_at?.split('T')[0] || '';
    if (d && r.status === 'Signed') byDate.set(d, (byDate.get(d) || 0) + 1);
    if (d && r.status === 'Failed') failedByDate.set(d, (failedByDate.get(d) || 0) + 1);
    byModule.set(r.module || 'Unknown', (byModule.get(r.module || 'Unknown') || 0) + 1);
    if (r.signature_meaning) byMeaning.set(r.signature_meaning, (byMeaning.get(r.signature_meaning) || 0) + 1);
    if (r.signer_name) byUser.set(r.signer_name, (byUser.get(r.signer_name) || 0) + 1);
  }

  return {
    dailyTrend: Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, count]) => ({ date, count })),
    moduleWise: Array.from(byModule.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
    meaningDistribution: Array.from(byMeaning.entries()).map(([name, value]) => ({ name, value })).slice(0, 10),
    failedAuthTrend: Array.from(failedByDate.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, count]) => ({ date, count })),
    userActivity: Array.from(byUser.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
  };
}

export function filterSignatureRecords(records: ElectronicSignatureRecord[], filters: SignatureFilters): ElectronicSignatureRecord[] {
  let result = [...records];
  const today = todayStr();
  if (filters.status) result = result.filter((r) => r.status === filters.status);
  if (filters.module) result = result.filter((r) => r.module === filters.module);
  if (filters.signer_id) result = result.filter((r) => r.signer_user_id === filters.signer_id);
  if (filters.meaning) result = result.filter((r) => r.signature_meaning === filters.meaning);
  if (filters.failed) result = result.filter((r) => r.status === 'Failed' || r.authentication_result === 'Failed');
  if (filters.today) result = result.filter((r) => r.signed_at?.startsWith(today));
  if (filters.dual) result = result.filter((r) => r.dual_signature_required);
  if (filters.document) result = result.filter((r) => /document|dms/i.test(r.module));
  if (filters.training) result = result.filter((r) => /training/i.test(r.module));
  if (filters.approval) result = result.filter((r) => /approval|capa|deviation|oos|change|risk|validation|pqr/i.test(r.module));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.signature_number.toLowerCase().includes(q) ||
      r.reference_number.toLowerCase().includes(q) ||
      r.signer_name.toLowerCase().includes(q) ||
      r.module.toLowerCase().includes(q),
    );
  }
  return result;
}

export function getPendingSignatures(records: ElectronicSignatureRecord[]) {
  return records.filter((r) => ['Pending', 'Dual Pending'].includes(r.status));
}

export function getFailedSignatures(records: ElectronicSignatureRecord[]) {
  return records.filter((r) => r.status === 'Failed' || r.authentication_result === 'Failed');
}

export function getDualPendingSignatures(records: ElectronicSignatureRecord[]) {
  return records.filter((r) => r.dual_signature_required && !r.dual_signature_completed);
}

export function getRecentSignatures(records: ElectronicSignatureRecord[]) {
  return [...records].filter((r) => r.status === 'Signed').sort((a, b) => b.signed_at.localeCompare(a.signed_at)).slice(0, 20);
}

export const SIGNATURE_KPI_FILTER_MAP: Record<string, Partial<SignatureFilters>> = {
  today: { today: true },
  pending: { status: 'Pending' },
  failed: { failed: true },
  document: { document: true },
  training: { training: true },
  approval: { approval: true },
  dual: { dual: true },
};
