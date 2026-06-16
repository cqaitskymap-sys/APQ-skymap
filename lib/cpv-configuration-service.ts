import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import {
  CPV_CONFIG_COLLECTIONS,
  CPV_CONFIGURATION_MODULE,
  DEFAULT_ANNUAL_TEMPLATE,
  DEFAULT_CAPABILITY_SETTINGS,
  DEFAULT_DATA_SOURCE_MAPPINGS,
  DEFAULT_EXPORT_SETTINGS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_LIMIT_RULES,
  DEFAULT_RISK_SETTINGS,
  DEFAULT_SPC_SETTINGS,
  type AlertRuleConfig,
  type AnnualReviewTemplate,
  type CapabilitySettings,
  type CpvConfigurationBundle,
  type CppConfiguration,
  type CqaConfiguration,
  type DataSourceMapping,
  type ExportReportSettings,
  type GeneralSettings,
  type LimitRule,
  type ProductCpvSettings,
  type ReviewFrequencyConfig,
  type RiskScoringSettings,
  type SpcSettings,
  type WorkflowMapping,
  validateConfiguration,
} from '@/lib/cpv-configuration-records';

export type CpvConfigActor = { id: string; name: string; role?: string };

const SINGLETON_DOCS = {
  general: 'general_settings',
  capability: 'process_capability_settings',
  spc: 'spc_settings',
  risk: 'risk_scoring_settings',
  export: 'export_report_settings',
} as const;

function nowIso() {
  return new Date().toISOString();
}

function str(v: unknown, fb = ''): string {
  if (v === null || v === undefined) return fb;
  return String(v);
}

function withAudit<T extends Record<string, unknown>>(data: T, actor: CpvConfigActor, isNew: boolean) {
  const now = nowIso();
  return {
    ...data,
    updatedAt: now,
    updatedBy: actor.id,
    ...(isNew ? { createdAt: now, createdBy: actor.id, isDeleted: false } : {}),
  };
}

async function logConfigAudit(
  actionType: string,
  collectionName: string,
  recordId: string,
  actor: CpvConfigActor,
  oldVal?: unknown,
  newVal?: unknown,
) {
  try {
    await createAuditLog({
      moduleName: CPV_CONFIGURATION_MODULE,
      collectionName,
      recordId,
      actionType,
      oldValue: oldVal,
      newValue: newVal,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName,
      documentId: recordId,
      action: actionType,
      oldValue: oldVal,
      newValue: newVal,
      userId: actor.id,
      userName: actor.name,
      moduleName: CPV_CONFIGURATION_MODULE,
    });
  } catch (e) {
    console.error('logConfigAudit failed', e);
  }
}

async function listCollection<T extends { id?: string; isDeleted?: boolean }>(
  collectionName: string,
  max = 500,
): Promise<T[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), collectionName),
      where('isDeleted', '==', false),
      orderBy('updatedAt', 'desc'),
      limit(max),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), collectionName), limit(max)));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as T))
        .filter((r) => r.isDeleted !== true);
    } catch (e) {
      console.error(`listCollection ${collectionName} failed`, e);
      return [];
    }
  }
}

async function getSingleton<T>(docId: string): Promise<(T & { id: string }) | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDoc(doc(getFirebaseFirestore(), CPV_CONFIG_COLLECTIONS.main, docId));
    if (!snap.exists() || snap.data()?.isDeleted) return null;
    return { id: snap.id, ...snap.data() } as T & { id: string };
  } catch (e) {
    console.error(`getSingleton ${docId} failed`, e);
    return null;
  }
}

async function saveSingleton<T extends Record<string, unknown>>(
  docId: string,
  data: T,
  actor: CpvConfigActor,
  actionType: string,
) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const existing = await getSingleton<T>(docId);
    const payload = withAudit(data, actor, !existing);
    await setDoc(doc(getFirebaseFirestore(), CPV_CONFIG_COLLECTIONS.main, docId), payload, { merge: true });
    await logConfigAudit(actionType, CPV_CONFIG_COLLECTIONS.main, docId, actor, existing, payload);
    return { error: null };
  } catch (e) {
    console.error(`saveSingleton ${docId} failed`, e);
    return { error: 'Failed to save configuration.' };
  }
}

export async function fetchCpvConfiguration(): Promise<CpvConfigurationBundle> {
  if (!isFirebaseConfigured()) {
    return {
      general: { ...DEFAULT_GENERAL_SETTINGS, id: 'default' },
      products: [],
      cppParameters: [],
      cqaParameters: [],
      limitRules: DEFAULT_LIMIT_RULES as LimitRule[],
      reviewFrequency: [],
      alertRules: [],
      capability: { ...DEFAULT_CAPABILITY_SETTINGS, id: 'default' },
      spc: { ...DEFAULT_SPC_SETTINGS, id: 'default' },
      risk: { ...DEFAULT_RISK_SETTINGS, id: 'default' },
      annualTemplates: [{ ...DEFAULT_ANNUAL_TEMPLATE, id: 'default' }],
      workflows: [],
      dataSourceMappings: DEFAULT_DATA_SOURCE_MAPPINGS as DataSourceMapping[],
      exportSettings: { ...DEFAULT_EXPORT_SETTINGS, id: 'default' },
    };
  }

  try {
    const [
      products, cppParameters, cqaParameters, limitRules, reviewFrequency,
      alertRules, annualTemplates, workflows, dataSourceMappings,
    ] = await Promise.all([
      listCollection<ProductCpvSettings>(CPV_CONFIG_COLLECTIONS.products),
      listCollection<CppConfiguration>(CPV_CONFIG_COLLECTIONS.cppParameters),
      listCollection<CqaConfiguration>(CPV_CONFIG_COLLECTIONS.cqaParameters),
      listCollection<LimitRule>(CPV_CONFIG_COLLECTIONS.limitRules),
      listCollection<ReviewFrequencyConfig>(CPV_CONFIG_COLLECTIONS.reviewFrequency),
      listCollection<AlertRuleConfig>(CPV_CONFIG_COLLECTIONS.alertRules),
      listCollection<AnnualReviewTemplate>(CPV_CONFIG_COLLECTIONS.reportTemplates),
      listCollection<WorkflowMapping>(CPV_CONFIG_COLLECTIONS.workflows),
      listCollection<DataSourceMapping>(CPV_CONFIG_COLLECTIONS.integrationMapping),
    ]);

    const [general, capability, spc, risk, exportSettings] = await Promise.all([
      getSingleton<GeneralSettings>(SINGLETON_DOCS.general),
      getSingleton<CapabilitySettings>(SINGLETON_DOCS.capability),
      getSingleton<SpcSettings>(SINGLETON_DOCS.spc),
      getSingleton<RiskScoringSettings>(SINGLETON_DOCS.risk),
      getSingleton<ExportReportSettings>(SINGLETON_DOCS.export),
    ]);

    return {
      general: general || ({ ...DEFAULT_GENERAL_SETTINGS, id: 'default' } as GeneralSettings),
      products,
      cppParameters,
      cqaParameters,
      limitRules: limitRules.length ? limitRules : (DEFAULT_LIMIT_RULES as LimitRule[]),
      reviewFrequency,
      alertRules,
      capability: capability || ({ ...DEFAULT_CAPABILITY_SETTINGS, id: 'default' } as CapabilitySettings),
      spc: spc || ({ ...DEFAULT_SPC_SETTINGS, id: 'default' } as SpcSettings),
      risk: risk || ({ ...DEFAULT_RISK_SETTINGS, id: 'default' } as RiskScoringSettings),
      annualTemplates: annualTemplates.length ? annualTemplates : [{ ...DEFAULT_ANNUAL_TEMPLATE, id: 'default' }],
      workflows,
      dataSourceMappings: dataSourceMappings.length ? dataSourceMappings : (DEFAULT_DATA_SOURCE_MAPPINGS as DataSourceMapping[]),
      exportSettings: exportSettings || ({ ...DEFAULT_EXPORT_SETTINGS, id: 'default' } as ExportReportSettings),
    };
  } catch (e) {
    console.error('fetchCpvConfiguration failed', e);
    return {
      general: null, products: [], cppParameters: [], cqaParameters: [], limitRules: [],
      reviewFrequency: [], alertRules: [], capability: null, spc: null, risk: null,
      annualTemplates: [], workflows: [], dataSourceMappings: [], exportSettings: null,
    };
  }
}

export async function saveGeneralSettings(data: GeneralSettings, actor: CpvConfigActor, reason?: string) {
  const { cpvEnabled, defaultReviewFrequency, ...rest } = data;
  if (cpvEnabled === undefined || cpvEnabled === null) return { error: 'CPV Enabled is required.' };
  if (!defaultReviewFrequency) return { error: 'Default Review Frequency is required.' };
  return saveSingleton(SINGLETON_DOCS.general, { ...rest, cpvEnabled, defaultReviewFrequency, changeReason: reason || '' }, actor, 'edit configuration');
}

export async function saveCapabilitySettings(data: CapabilitySettings, actor: CpvConfigActor, reason?: string) {
  if (data.minimumSampleCount < 1) return { error: 'Minimum sample count must be at least 1.' };
  return saveSingleton(SINGLETON_DOCS.capability, { ...data, changeReason: reason || '' }, actor, 'change Cpk threshold');
}

export async function saveSpcSettings(data: SpcSettings, actor: CpvConfigActor, reason?: string) {
  return saveSingleton(SINGLETON_DOCS.spc, { ...data, changeReason: reason || '' }, actor, 'edit configuration');
}

export async function saveRiskSettings(data: RiskScoringSettings, actor: CpvConfigActor, reason?: string) {
  return saveSingleton(SINGLETON_DOCS.risk, { ...data, changeReason: reason || '' }, actor, 'change risk scoring');
}

export async function saveExportSettings(data: ExportReportSettings, actor: CpvConfigActor, reason?: string) {
  return saveSingleton(SINGLETON_DOCS.export, { ...data, changeReason: reason || '' }, actor, 'edit configuration');
}

export async function createConfigListRecord<T extends Record<string, unknown>>(
  collectionName: string,
  data: T,
  actor: CpvConfigActor,
  actionType = 'create configuration',
) {
  if (!isFirebaseConfigured()) return { id: null, error: 'Firebase is not configured.' };
  try {
    const payload = withAudit(data, actor, true);
    const ref = await addDoc(collection(getFirebaseFirestore(), collectionName), payload);
    await logConfigAudit(actionType, collectionName, ref.id, actor, null, payload);
    return { id: ref.id, error: null };
  } catch (e) {
    console.error(`createConfigListRecord ${collectionName} failed`, e);
    return { id: null, error: 'Failed to create configuration record.' };
  }
}

export async function updateConfigListRecord<T extends Record<string, unknown>>(
  collectionName: string,
  id: string,
  data: Partial<T>,
  actor: CpvConfigActor,
  actionType = 'edit configuration',
) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const payload = withAudit(data, actor, false);
    await updateDoc(doc(getFirebaseFirestore(), collectionName, id), payload);
    await logConfigAudit(actionType, collectionName, id, actor, null, payload);
    return { error: null };
  } catch (e) {
    console.error(`updateConfigListRecord ${collectionName} failed`, e);
    return { error: 'Failed to update configuration record.' };
  }
}

export async function softDeleteConfigRecord(
  collectionName: string,
  id: string,
  actor: CpvConfigActor,
  actionType = 'edit configuration',
) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const payload = { isDeleted: true, updatedAt: nowIso(), updatedBy: actor.id };
    await updateDoc(doc(getFirebaseFirestore(), collectionName, id), payload);
    await logConfigAudit(actionType, collectionName, id, actor, null, payload);
    return { error: null };
  } catch (e) {
    console.error(`softDeleteConfigRecord ${collectionName} failed`, e);
    return { error: 'Failed to delete configuration record.' };
  }
}

export async function resetConfigurationDefaults(actor: CpvConfigActor) {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await Promise.all([
      saveSingleton(SINGLETON_DOCS.general, DEFAULT_GENERAL_SETTINGS, actor, 'reset defaults'),
      saveSingleton(SINGLETON_DOCS.capability, DEFAULT_CAPABILITY_SETTINGS, actor, 'reset defaults'),
      saveSingleton(SINGLETON_DOCS.spc, DEFAULT_SPC_SETTINGS, actor, 'reset defaults'),
      saveSingleton(SINGLETON_DOCS.risk, DEFAULT_RISK_SETTINGS, actor, 'reset defaults'),
      saveSingleton(SINGLETON_DOCS.export, DEFAULT_EXPORT_SETTINGS, actor, 'reset defaults'),
    ]);

    for (const rule of DEFAULT_LIMIT_RULES) {
      await createConfigListRecord(CPV_CONFIG_COLLECTIONS.limitRules, rule, actor, 'reset defaults');
    }
    for (const mapping of DEFAULT_DATA_SOURCE_MAPPINGS) {
      await createConfigListRecord(CPV_CONFIG_COLLECTIONS.integrationMapping, mapping, actor, 'reset defaults');
    }
    await createConfigListRecord(CPV_CONFIG_COLLECTIONS.reportTemplates, DEFAULT_ANNUAL_TEMPLATE, actor, 'reset defaults');

    await logConfigAudit('reset defaults', CPV_CONFIG_COLLECTIONS.main, 'all', actor);
    return { error: null };
  } catch (e) {
    console.error('resetConfigurationDefaults failed', e);
    return { error: 'Failed to reset configuration.' };
  }
}

export async function exportConfigurationJson(): Promise<{ json: string; error: string | null }> {
  try {
    const bundle = await fetchCpvConfiguration();
    return { json: JSON.stringify(bundle, null, 2), error: null };
  } catch {
    return { json: '', error: 'Failed to export configuration.' };
  }
}

export async function importConfigurationJson(json: string, actor: CpvConfigActor) {
  try {
    const parsed = JSON.parse(json) as Partial<CpvConfigurationBundle>;
    if (parsed.general) await saveGeneralSettings(parsed.general, actor, 'JSON import');
    if (parsed.capability) await saveCapabilitySettings(parsed.capability, actor, 'JSON import');
    if (parsed.spc) await saveSpcSettings(parsed.spc, actor, 'JSON import');
    if (parsed.risk) await saveRiskSettings(parsed.risk, actor, 'JSON import');
    if (parsed.exportSettings) await saveExportSettings(parsed.exportSettings, actor, 'JSON import');

    const listImports: Array<[string, unknown[] | undefined]> = [
      [CPV_CONFIG_COLLECTIONS.products, parsed.products],
      [CPV_CONFIG_COLLECTIONS.cppParameters, parsed.cppParameters],
      [CPV_CONFIG_COLLECTIONS.cqaParameters, parsed.cqaParameters],
      [CPV_CONFIG_COLLECTIONS.limitRules, parsed.limitRules],
      [CPV_CONFIG_COLLECTIONS.reviewFrequency, parsed.reviewFrequency],
      [CPV_CONFIG_COLLECTIONS.alertRules, parsed.alertRules],
      [CPV_CONFIG_COLLECTIONS.reportTemplates, parsed.annualTemplates],
      [CPV_CONFIG_COLLECTIONS.workflows, parsed.workflows],
      [CPV_CONFIG_COLLECTIONS.integrationMapping, parsed.dataSourceMappings],
    ];

    for (const [col, rows] of listImports) {
      if (!rows?.length) continue;
      for (const row of rows) {
        const { id: _id, ...rest } = row as Record<string, unknown>;
        await createConfigListRecord(col, rest, actor, 'import configuration');
      }
    }

    await logConfigAudit('import configuration', CPV_CONFIG_COLLECTIONS.main, 'import', actor);
    return { error: null };
  } catch (e) {
    console.error('importConfigurationJson failed', e);
    return { error: 'Invalid configuration JSON.' };
  }
}

export async function testConfiguration(): Promise<{ ok: boolean; message: string; details: string[] }> {
  const bundle = await fetchCpvConfiguration();
  const validation = validateConfiguration(bundle);
  const details = [...validation.errors, ...validation.warnings];
  return {
    ok: validation.valid,
    message: validation.valid
      ? `Configuration test passed (${validation.completenessPct}% complete).`
      : 'Configuration test failed.',
    details,
  };
}

export async function logConfigurationExport(actor: CpvConfigActor) {
  await logConfigAudit('export configuration', CPV_CONFIG_COLLECTIONS.main, 'export', actor);
}

export function isProductCpvRequired(bundle: CpvConfigurationBundle, productName: string): boolean {
  const product = bundle.products.find((p) => p.product === productName && p.status === 'Active');
  if (product) return product.cpvRequired;
  return bundle.general?.cpvEnabled !== false;
}

/* Collection helpers for UI */
export const CONFIG_LIST_COLLECTIONS = {
  product: CPV_CONFIG_COLLECTIONS.products,
  cpp: CPV_CONFIG_COLLECTIONS.cppParameters,
  cqa: CPV_CONFIG_COLLECTIONS.cqaParameters,
  limits: CPV_CONFIG_COLLECTIONS.limitRules,
  'review-frequency': CPV_CONFIG_COLLECTIONS.reviewFrequency,
  'alert-rules': CPV_CONFIG_COLLECTIONS.alertRules,
  'annual-template': CPV_CONFIG_COLLECTIONS.reportTemplates,
  workflow: CPV_CONFIG_COLLECTIONS.workflows,
  'data-source': CPV_CONFIG_COLLECTIONS.integrationMapping,
} as const;

export async function fetchAlertRulesFromConfig(): Promise<AlertRuleConfig[]> {
  const rows = await listCollection<AlertRuleConfig>(CPV_CONFIG_COLLECTIONS.alertRules);
  if (rows.length) return rows;
  try {
    const legacy = await listCollection<AlertRuleConfig>('alert_rules');
    return legacy;
  } catch {
    return [];
  }
}

export function normalizeLegacyCppRecord(raw: Record<string, unknown>): Partial<CppConfiguration> {
  return {
    parameterCode: str(raw.parameterCode || raw.parameterName),
    parameterName: str(raw.parameterName),
    processStage: str(raw.processStage, 'Manufacturing'),
    targetValue: Number(raw.target ?? raw.targetValue ?? 0),
    lowerLimit: Number(raw.lsl ?? raw.lowerLimit ?? 0),
    upperLimit: Number(raw.usl ?? raw.upperLimit ?? 0),
    unit: str(raw.unit),
    frequency: str(raw.samplingFrequency || raw.frequency, 'Per Batch'),
    status: (raw.status as 'Active' | 'Inactive') || 'Active',
  };
}
