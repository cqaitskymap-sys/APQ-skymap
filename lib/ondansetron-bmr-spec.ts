/**
 * Ondansetron Injection BMR Specification
 * Source: data/Ondansetron_Injection_BMR_Specification_Corrected.xlsx
 */

import {
  CQA_PARAMETER_ALIASES,
  cqaParameterNamesMatch,
  getCqaParametersForStage,
  type CqaStageParameterOption,
} from '@/lib/cpv-cqa-monitoring';

export const ONDANSETRON_PRODUCT_KEY = 'ondansetron';

export interface BmrSpecLimit {
  lower: string | number | null;
  upper: string | number | null;
}

export interface BmrSpecParameter {
  srNo: number;
  parameter: string;
  limits: BmrSpecLimit;
  responsibility: string;
  remarks?: string;
}

export interface BmrSpecSection {
  section: string;
  parameters: BmrSpecParameter[];
}

export interface ParsedNumericLimit {
  lsl: number;
  usl: number;
  target: number;
  unit: string;
  specification: string;
  oneSided?: 'min' | 'max';
}

export const ONDANSETRON_BATCH_DEFAULTS = {
  productName: 'Ondansetron Injection',
  genericName: 'Ondansetron',
  strength: '2 mg/mL',
  batchSizeLitres: 860,
  stdFillVolumeMl: 2.15,
  batchSizeNos: 400_000,
  batchSizeDisplay: '400000 nos / 860 L',
  bmrVersion: '1.0',
} as const;

export const ONDANSETRON_DISPENSING_MATERIALS = [
  {
    materialType: 'API' as const,
    materialName: 'Ondansetron HCl / Base',
    materialCode: 'OND-API-001',
    unit: 'kg',
    remarks: 'Per approved API specification',
  },
  {
    materialType: 'Primary Packing' as const,
    materialName: 'Clear Glass Ampoule 2 mL',
    materialCode: 'AMP-CG-2ML-001',
    requiredQuantity: 192_307,
    unit: 'Nos.',
    remarks: '~4.8% overage on 400000 nos.',
  },
] as const;

export const ONDANSETRON_INJECTION_BMR_SPEC: BmrSpecSection[] = [
  {
    section: 'BATCH DETAILS',
    parameters: [
      { srNo: 1, parameter: 'FP Batch No.', limits: { lower: null, upper: null }, responsibility: 'Production', remarks: 'Record at batch start' },
      { srNo: 2, parameter: 'Mfg. Date', limits: { lower: null, upper: null }, responsibility: 'Production', remarks: 'Record at batch start' },
      { srNo: 3, parameter: 'Exp. Date', limits: { lower: null, upper: null }, responsibility: 'Production', remarks: 'As per shelf life' },
      { srNo: 4, parameter: 'Batch Size (Litre)', limits: { lower: 860, upper: 860 }, responsibility: 'Production' },
      { srNo: 5, parameter: 'Std. Fill Vol. (mL)', limits: { lower: 2.15, upper: 2.15 }, responsibility: 'Production' },
      { srNo: 6, parameter: 'Batch Size (Nos.)', limits: { lower: 400_000, upper: 400_000 }, responsibility: 'Production' },
    ],
  },
  {
    section: 'DISPENSING',
    parameters: [
      { srNo: 1, parameter: 'Temperature (°C)', limits: { lower: null, upper: 'NMT 25' }, responsibility: 'IPQA' },
      { srNo: 2, parameter: 'Relative Humidity (%)', limits: { lower: null, upper: 'NMT 55' }, responsibility: 'IPQA' },
    ],
  },
  {
    section: 'STARTING MATERIAL (API)',
    parameters: [
      { srNo: 1, parameter: 'Item Code', limits: { lower: 'OND-API-001', upper: 'OND-API-001' }, responsibility: 'Stores / QA', remarks: 'Ondansetron HCl / Base per approved spec' },
      { srNo: 2, parameter: 'Mfg. Date', limits: { lower: null, upper: null }, responsibility: 'Stores', remarks: 'Record at dispensing from label' },
      { srNo: 3, parameter: 'Exp. Date', limits: { lower: null, upper: null }, responsibility: 'Stores', remarks: 'Record at dispensing from label' },
      { srNo: 4, parameter: 'Assay (ODB) (%)', limits: { lower: 98, upper: 102 }, responsibility: 'QC' },
      { srNo: 5, parameter: 'Water / LOD', limits: { lower: 9.0, upper: 10.5 }, responsibility: 'QC' },
      { srNo: 6, parameter: 'Ondansetron Imp. C (%)', limits: { lower: null, upper: 'NMT 0.2' }, responsibility: 'QC' },
      { srNo: 7, parameter: 'Imidazole (%)', limits: { lower: null, upper: 'NMT 0.2' }, responsibility: 'QC' },
      { srNo: 8, parameter: '2-Methylimidazole (%)', limits: { lower: null, upper: 'NMT 0.2' }, responsibility: 'QC' },
      { srNo: 9, parameter: 'Ondansetron Imp. A (%)', limits: { lower: null, upper: 'NMT 0.2' }, responsibility: 'QC' },
      { srNo: 10, parameter: 'Ondansetron Imp. D (%)', limits: { lower: null, upper: 'NMT 0.12' }, responsibility: 'QC', remarks: 'Aligned with FP spec' },
      { srNo: 11, parameter: 'Sum of Related Substances (%)', limits: { lower: null, upper: 'NMT 0.5' }, responsibility: 'QC' },
    ],
  },
  {
    section: 'PRIMARY PACKING MATERIAL',
    parameters: [
      { srNo: 1, parameter: 'Item Code', limits: { lower: 'AMP-CG-2ML-001', upper: 'AMP-CG-2ML-001' }, responsibility: 'Stores', remarks: 'Clear Glass Ampoule 2 mL' },
      { srNo: 2, parameter: 'AR No.', limits: { lower: null, upper: null }, responsibility: 'Stores', remarks: 'Record at dispensing' },
      { srNo: 3, parameter: 'Qty Issued (Nos.)', limits: { lower: 192_307, upper: 192_307 }, responsibility: 'Stores', remarks: '~4.8% overage on 400000 nos.' },
    ],
  },
  {
    section: 'STERILIZATION OF EQUIPMENT',
    parameters: [
      { srNo: 1, parameter: 'Cleaned MP Hold Time (hr)', limits: { lower: null, upper: 'NMT 24' }, responsibility: 'IPQA', remarks: 'Machine Parts (MP)' },
      { srNo: 2, parameter: 'Sterilization Temperature — MP (°C)', limits: { lower: 'NLT 121', upper: null }, responsibility: 'IPQA', remarks: 'Machine Parts' },
      { srNo: 3, parameter: 'Sterilization Hold Time — MP (min)', limits: { lower: 'NLT 30', upper: null }, responsibility: 'IPQA', remarks: 'Machine Parts' },
      { srNo: 4, parameter: 'Hold Time of Sterilized — MP (hr)', limits: { lower: null, upper: 'NMT 24' }, responsibility: 'IPQA', remarks: 'Machine Parts' },
      { srNo: 5, parameter: 'Sterilization Temperature — MV (°C)', limits: { lower: 'NLT 121', upper: null }, responsibility: 'IPQA', remarks: 'Mixing Vessel' },
      { srNo: 6, parameter: 'Sterilization Hold Time — MV (min)', limits: { lower: 'NLT 30', upper: null }, responsibility: 'IPQA', remarks: 'Mixing Vessel' },
      { srNo: 7, parameter: 'Hold Time of Sterilized — MV (hr)', limits: { lower: null, upper: 'NMT 24' }, responsibility: 'IPQA', remarks: 'Mixing Vessel' },
      { srNo: 8, parameter: 'Sterilization Temperature — HV/BV (°C)', limits: { lower: 'NLT 121', upper: null }, responsibility: 'IPQA', remarks: 'Holding / Buffer Vessel' },
      { srNo: 9, parameter: 'Sterilization Hold Time — HV/BV (min)', limits: { lower: 'NLT 30', upper: null }, responsibility: 'IPQA', remarks: 'Holding / Buffer Vessel' },
      { srNo: 10, parameter: 'Hold Time of Sterilized — HV/BV (hr)', limits: { lower: null, upper: 'NMT 24' }, responsibility: 'IPQA', remarks: 'Holding / Buffer Vessel' },
    ],
  },
  {
    section: 'GLASS CONTAINER WASHING',
    parameters: [
      { srNo: 1, parameter: 'Compressed Air Pressure (MPa)', limits: { lower: 'NLT 0.20', upper: 'NMT 0.40' }, responsibility: 'IPQA' },
      { srNo: 2, parameter: 'Recycled WFI-I Pressure (MPa)', limits: { lower: 'NLT 0.15', upper: 'NMT 0.30' }, responsibility: 'IPQA' },
      { srNo: 3, parameter: 'Recycled WFI-II Pressure (MPa)', limits: { lower: 'NLT 0.15', upper: 'NMT 0.30' }, responsibility: 'IPQA' },
      { srNo: 4, parameter: 'Fresh WFI Pressure (MPa)', limits: { lower: 'NLT 0.15', upper: 'NMT 0.30' }, responsibility: 'IPQA' },
    ],
  },
  {
    section: 'GLASS CONTAINER DEPYROGENATION',
    parameters: [
      { srNo: 1, parameter: 'Preheat Zone DP (Pa)', limits: { lower: 'NLT 10', upper: 'NMT 30' }, responsibility: 'IPQA' },
      { srNo: 2, parameter: 'Preheat Zone Temperature (°C)', limits: { lower: 'NLT 100', upper: 'NMT 200' }, responsibility: 'IPQA' },
      { srNo: 3, parameter: 'Heating Zone DP (Pa)', limits: { lower: 'NLT 10', upper: 'NMT 30' }, responsibility: 'IPQA' },
      { srNo: 4, parameter: 'Heating Zone Temperature (°C)', limits: { lower: 'NLT 280', upper: 'NMT 320' }, responsibility: 'IPQA' },
      { srNo: 5, parameter: 'Cooling Zone DP (Pa)', limits: { lower: 'NLT 10', upper: 'NMT 30' }, responsibility: 'IPQA' },
      { srNo: 6, parameter: 'Cooling Zone Temperature (°C)', limits: { lower: 'NLT 20', upper: 'NMT 80' }, responsibility: 'IPQA' },
    ],
  },
  {
    section: 'MIXING',
    parameters: [
      { srNo: 1, parameter: 'Mixing RPM', limits: { lower: 'NLT 250', upper: 'NMT 400' }, responsibility: 'IPQA' },
      { srNo: 2, parameter: 'Mixing Time (min)', limits: { lower: 'NLT 12', upper: 'NMT 18' }, responsibility: 'IPQA', remarks: 'Range per BMR' },
      { srNo: 3, parameter: 'Mixing Volume (L)', limits: { lower: 860, upper: 860 }, responsibility: 'IPQA' },
      { srNo: 4, parameter: 'Bulk Hold Time (hr)', limits: { lower: null, upper: 'NMT 12' }, responsibility: 'IPQA' },
    ],
  },
  {
    section: 'BULK RESULTS',
    parameters: [
      { srNo: 1, parameter: 'Description', limits: { lower: 'Clear Solution', upper: 'Clear Solution' }, responsibility: 'IPQA' },
      { srNo: 2, parameter: 'pH', limits: { lower: 3.5, upper: 3.8 }, responsibility: 'IPQA' },
      { srNo: 3, parameter: 'Colour Index (AU)', limits: { lower: null, upper: 'NMT 0.200' }, responsibility: 'IPQA' },
      { srNo: 4, parameter: 'Weight per mL (g/mL)', limits: { lower: 'NLT 1.00', upper: 'NMT 1.05' }, responsibility: 'IPQA' },
      { srNo: 5, parameter: 'Assay (%)', limits: { lower: 97, upper: 103 }, responsibility: 'IPQA' },
      { srNo: 6, parameter: 'Total Viable Count (CFU/100 mL)', limits: { lower: null, upper: 'NMT 10' }, responsibility: 'IPQA', remarks: 'Per sterile bulk spec' },
    ],
  },
  {
    section: 'FILTRATION PROCESS',
    parameters: [
      { srNo: 1, parameter: 'Filter Make', limits: { lower: 'Sartorius', upper: 'Sartorius' }, responsibility: 'IPQA' },
      { srNo: 2, parameter: 'Primary Integrity — Pre (BPT) (mbar)', limits: { lower: 'NLT 3172', upper: 'NMT 5000' }, responsibility: 'IPQA' },
      { srNo: 3, parameter: 'Primary Integrity — Post (BPT) (mbar)', limits: { lower: 'NLT 3172', upper: 'NMT 5000' }, responsibility: 'IPQA' },
      { srNo: 4, parameter: 'Secondary Integrity — Pre (BPT) (mbar)', limits: { lower: 'NLT 3172', upper: 'NMT 5000' }, responsibility: 'IPQA' },
      { srNo: 5, parameter: 'Secondary Integrity — Post (BPT) (mbar)', limits: { lower: 'NLT 3172', upper: 'NMT 5000' }, responsibility: 'IPQA' },
      { srNo: 6, parameter: 'Filtration Pressure (bar) — Min', limits: { lower: 'NLT 2.0', upper: null }, responsibility: 'IPQA', remarks: 'Record at defined frequency throughout filtration' },
      { srNo: 7, parameter: 'Filtration Pressure (bar) — Max', limits: { lower: null, upper: 'NMT 4.0' }, responsibility: 'IPQA', remarks: 'Upper limit for OOT/OOS' },
      { srNo: 8, parameter: 'Filtration Time (min)', limits: { lower: null, upper: 'NMT 120' }, responsibility: 'IPQA' },
      { srNo: 9, parameter: 'Hold Tank Volume (L)', limits: { lower: 860, upper: 860 }, responsibility: 'IPQA' },
      { srNo: 10, parameter: 'Solution Hold Time (min)', limits: { lower: null, upper: 'NMT 720' }, responsibility: 'IPQA' },
      { srNo: 11, parameter: 'Filtration Yield (%)', limits: { lower: 96, upper: null }, responsibility: 'IPQA' },
    ],
  },
  {
    section: 'FILLING PROCESS',
    parameters: [
      { srNo: 1, parameter: 'Fill Volume (mL)', limits: { lower: 2.1, upper: 2.2 }, responsibility: 'IPQA' },
      { srNo: 2, parameter: 'N₂ Pressure Pre-Fill (kg/cm²)', limits: { lower: 'NLT 2.0', upper: 'NMT 3.5' }, responsibility: 'IPQA', remarks: 'Periodic recording during process' },
      { srNo: 3, parameter: 'Machine Speed (ampoules/min)', limits: { lower: 275, upper: 550 }, responsibility: 'IPQA' },
      { srNo: 4, parameter: 'NVPC — 0.5 µm (particles/m³)', limits: { lower: null, upper: 3520 }, responsibility: 'IPQA', remarks: 'Covered in PV protocol' },
      { srNo: 5, parameter: 'NVPC — 5 µm (particles/m³)', limits: { lower: null, upper: 20 }, responsibility: 'IPQA', remarks: 'Covered in PV protocol' },
      { srNo: 6, parameter: 'Units Filled (Nos.)', limits: { lower: null, upper: 400_000 }, responsibility: 'IPQA' },
      { srNo: 7, parameter: 'Filling Time (hr)', limits: { lower: null, upper: 'NMT 24' }, responsibility: 'IPQA' },
      { srNo: 8, parameter: 'Max Filled Nos. (calc.)', limits: { lower: null, upper: 792_000 }, responsibility: 'IPQA', remarks: '≤ speed × 60 × filling hrs (550×60×24)' },
      { srNo: 9, parameter: 'Filling Yield (%)', limits: { lower: 97, upper: 100 }, responsibility: 'IPQA' },
    ],
  },
  {
    section: 'FINISHED PRODUCT DATA',
    parameters: [
      { srNo: 1, parameter: 'Description', limits: { lower: 'Clear Solution', upper: 'Clear Solution' }, responsibility: 'QA' },
      { srNo: 2, parameter: 'Identification', limits: { lower: 'Complies', upper: 'Complies' }, responsibility: 'QA' },
      { srNo: 3, parameter: 'pH', limits: { lower: 3.300, upper: 4.000 }, responsibility: 'QA' },
      { srNo: 4, parameter: 'Extractable Volume (mL)', limits: { lower: 'NLT 2.0', upper: null }, responsibility: 'QA' },
      { srNo: 5, parameter: 'Particulate Matter — Visible', limits: { lower: 0, upper: 0 }, responsibility: 'QA' },
      { srNo: 6, parameter: 'Particulate Matter — ≥10 µm (/mL)', limits: { lower: null, upper: 'NMT 6000' }, responsibility: 'QA' },
      { srNo: 7, parameter: 'Particulate Matter — ≥25 µm (/mL)', limits: { lower: null, upper: 'NMT 600' }, responsibility: 'QA' },
      { srNo: 8, parameter: 'Bacterial Endotoxin (EU/mg)', limits: { lower: null, upper: 'NMT 9.9' }, responsibility: 'QA' },
      { srNo: 9, parameter: 'Sterility', limits: { lower: 'Pass', upper: 'Pass' }, responsibility: 'QA' },
      { srNo: 10, parameter: 'Ondansetron Imp. D (%)', limits: { lower: null, upper: 'NMT 0.12' }, responsibility: 'QA' },
      { srNo: 11, parameter: 'Any Secondary Impurity (%)', limits: { lower: null, upper: 'NMT 0.2' }, responsibility: 'QA' },
      { srNo: 12, parameter: 'Sum of All Impurities (%)', limits: { lower: null, upper: 'NMT 0.5' }, responsibility: 'QA' },
      { srNo: 13, parameter: 'Assay (%)', limits: { lower: 95, upper: 105 }, responsibility: 'QA' },
      { srNo: 14, parameter: 'Preservative — Methyl Paraben (%)', limits: { lower: 'NLT 80', upper: null }, responsibility: 'QA', remarks: '≥80% of label claim' },
      { srNo: 15, parameter: 'Preservative — Propyl Paraben (%)', limits: { lower: 'NLT 80', upper: null }, responsibility: 'QA', remarks: '≥80% of label claim' },
    ],
  },
];

const LIMIT_TOKEN = /^NMT\s+|^NLT\s+/i;

function parseLimitValue(raw: string | number | null): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim();
  if (!s || s === '—' || s === '-') return null;
  const num = parseFloat(s.replace(LIMIT_TOKEN, ''));
  return Number.isFinite(num) ? num : null;
}

function formatLimitLabel(raw: string | number | null): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

/** Parse BMR lower/upper limits into numeric LSL/USL for CPP/IPC forms. */
export function parseBmrLimits(
  lower: string | number | null,
  upper: string | number | null,
  unit = '',
): ParsedNumericLimit | null {
  const lowerStr = formatLimitLabel(lower);
  const upperStr = formatLimitLabel(upper);
  const lowerNum = parseLimitValue(lower);
  const upperNum = parseLimitValue(upper);

  if (lowerNum === null && upperNum === null) {
    if (lowerStr && upperStr && lowerStr === upperStr) {
      return { lsl: 0, usl: 0, target: 0, unit, specification: lowerStr, oneSided: undefined };
    }
    return null;
  }

  let lsl = lowerNum ?? 0;
  let usl = upperNum ?? (lowerNum !== null ? lowerNum * 2 || 999999 : 999999);

  if (typeof lower === 'string' && /^NLT/i.test(lower) && upperNum === null) {
    usl = Math.max(lsl * 1.5, lsl + 10);
  }
  if (typeof upper === 'string' && /^NMT/i.test(upper) && lowerNum === null) {
    lsl = 0;
  }

  const target = lowerNum !== null && upperNum !== null
    ? (lowerNum + upperNum) / 2
    : lowerNum ?? upperNum ?? 0;

  const specParts: string[] = [];
  if (lowerStr) specParts.push(lowerStr);
  if (upperStr && upperStr !== lowerStr) specParts.push(upperStr);

  return {
    lsl,
    usl: usl > lsl ? usl : lsl + 0.001,
    target,
    unit,
    specification: specParts.join(' – ') || `${lsl} – ${usl}`,
    oneSided: lowerNum !== null && upperNum === null ? 'min' : upperNum !== null && lowerNum === null ? 'max' : undefined,
  };
}

export function isOndansetronProduct(productName: string): boolean {
  return productName.toLowerCase().includes(ONDANSETRON_PRODUCT_KEY);
}

export function getBmrSpecParameter(parameterName: string): (BmrSpecParameter & { section: string }) | undefined {
  for (const sec of ONDANSETRON_INJECTION_BMR_SPEC) {
    const param = sec.parameters.find((p) => p.parameter === parameterName);
    if (param) return { ...param, section: sec.section };
  }
  return undefined;
}

export function getAllBmrCppParameters(): string[] {
  const sections = [
    'DISPENSING',
    'STERILIZATION OF EQUIPMENT',
    'GLASS CONTAINER WASHING',
    'GLASS CONTAINER DEPYROGENATION',
    'MIXING',
    'FILTRATION PROCESS',
    'FILLING PROCESS',
  ];
  return ONDANSETRON_INJECTION_BMR_SPEC
    .filter((s) => sections.includes(s.section))
    .flatMap((s) => s.parameters.map((p) => p.parameter));
}

/** Maps CPP process stage → BMR spec sections (Ondansetron Injection). */
export const CPP_STAGE_TO_BMR_SECTIONS: Record<string, string[]> = {
  Dispensing: ['DISPENSING'],
  Sterilization: ['STERILIZATION OF EQUIPMENT'],
  'Vial Washing': ['GLASS CONTAINER WASHING'],
  Depyrogenation: ['GLASS CONTAINER DEPYROGENATION'],
  Mixing: ['MIXING'],
  Filtration: ['FILTRATION PROCESS'],
  Filling: ['FILLING PROCESS'],
};

export interface OndansetronCppOption {
  id: string;
  parameterName: string;
  parameterCode: string;
  section: string;
  responsibility: string;
  specificationText: string;
  target: number;
  lsl: number;
  usl: number;
  unit: string;
  resultType: 'Numeric' | 'Text';
  criticality: 'Critical' | 'Major' | 'Minor';
  processStage: string;
}

function cppCriticality(name: string): OndansetronCppOption['criticality'] {
  const n = name.toLowerCase();
  if (n.includes('fill volume') || n.includes('sterilization temp')) return 'Critical';
  if (n.includes('integrity') || n.includes('filtration pressure')) return 'Major';
  return 'Major';
}

function cppProcessStageForSection(section: string): string {
  for (const [stage, sections] of Object.entries(CPP_STAGE_TO_BMR_SECTIONS)) {
    if (sections.includes(section)) return stage;
  }
  return 'Mixing';
}

export function getOndansetronCppOptionsForStage(processStage: string): OndansetronCppOption[] {
  const sections = CPP_STAGE_TO_BMR_SECTIONS[processStage] || [];
  const options: OndansetronCppOption[] = [];

  for (const sec of ONDANSETRON_INJECTION_BMR_SPEC) {
    if (!sections.includes(sec.section)) continue;
    for (const p of sec.parameters) {
      const parsed = parseBmrLimits(p.limits.lower, p.limits.upper);
      const alias = ONDANSETRON_PARAMETER_SPECS[p.parameter]
        || ONDANSETRON_PARAMETER_SPECS[p.parameter.replace(/\s*\([^)]+\)/, '')];
      const unitMatch = p.parameter.match(/\(([^)]+)\)/);
      const unit = alias?.unit ?? parsed?.unit ?? unitMatch?.[1] ?? '';
      const code = p.parameter.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 24);
      options.push({
        id: `bmr-cpp-${code}`,
        parameterName: p.parameter,
        parameterCode: `CPP_${code}`,
        section: sec.section,
        responsibility: p.responsibility,
        specificationText: parsed?.specification ?? `${p.limits.lower ?? '—'} / ${p.limits.upper ?? '—'}`,
        target: alias?.target ?? parsed?.target ?? 0,
        lsl: alias?.lsl ?? parsed?.lsl ?? 0,
        usl: alias?.usl ?? parsed?.usl ?? 0,
        unit,
        resultType: parsed ? 'Numeric' : 'Text',
        criticality: cppCriticality(p.parameter),
        processStage: cppProcessStageForSection(sec.section),
      });
    }
  }
  return options;
}

export function resolveOndansetronCppDefaults(parameterName: string): Partial<OndansetronCppOption> | null {
  const alias = ONDANSETRON_PARAMETER_SPECS[parameterName];
  const bmr = getBmrSpecParameter(parameterName);
  if (!alias && !bmr) return null;
  const parsed = bmr ? parseBmrLimits(bmr.limits.lower, bmr.limits.upper) : null;
  const unitMatch = parameterName.match(/\(([^)]+)\)/);
  return {
    parameterName,
    responsibility: bmr?.responsibility ?? 'IPQA',
    specificationText: parsed?.specification ?? '',
    target: alias?.target ?? parsed?.target ?? 0,
    lsl: alias?.lsl ?? parsed?.lsl ?? 0,
    usl: alias?.usl ?? parsed?.usl ?? 0,
    unit: alias?.unit ?? parsed?.unit ?? unitMatch?.[1] ?? '',
    processStage: bmr ? cppProcessStageForSection(bmr.section) : 'Mixing',
    criticality: cppCriticality(parameterName),
  };
}

export function getAllBmrIpcParameters(): string[] {
  const sections = ['BULK RESULTS', 'FILTRATION PROCESS', 'FILLING PROCESS', 'FINISHED PRODUCT DATA'];
  return ONDANSETRON_INJECTION_BMR_SPEC
    .filter((s) => sections.includes(s.section))
    .flatMap((s) => s.parameters.map((p) => p.parameter));
}

export function getIpcSpecification(parameterName: string): string {
  const param = getBmrSpecParameter(parameterName);
  if (!param) return '';
  const parsed = parseBmrLimits(param.limits.lower, param.limits.upper);
  return parsed?.specification ?? '';
}

export function getCppDefaults(parameterName: string): ParsedNumericLimit | null {
  const param = getBmrSpecParameter(parameterName);
  if (!param) return null;
  const unitMatch = parameterName.match(/\(([^)]+)\)/);
  const unit = unitMatch?.[1] ?? '';
  return parseBmrLimits(param.limits.lower, param.limits.upper, unit);
}

/** Ondansetron-specific CPV parameter limits aligned with BMR spec. */
export const ONDANSETRON_PARAMETER_SPECS: Record<string, { target: number; lsl: number; usl: number; unit: string }> = {
  'Temperature (°C)': { target: 22, lsl: 0, usl: 25, unit: '°C' },
  'Relative Humidity (%)': { target: 40, lsl: 0, usl: 55, unit: '%' },
  'Fill Volume': { target: 2.15, lsl: 2.1, usl: 2.2, unit: 'mL' },
  'Fill Volume (mL)': { target: 2.15, lsl: 2.1, usl: 2.2, unit: 'mL' },
  'Mixing Time': { target: 15, lsl: 12, usl: 18, unit: 'min' },
  'Mixing Time (min)': { target: 15, lsl: 12, usl: 18, unit: 'min' },
  'Mixing RPM': { target: 325, lsl: 250, usl: 400, unit: 'RPM' },
  'Bulk Hold Time': { target: 6, lsl: 0, usl: 12, unit: 'hr' },
  'Bulk Hold Time (hr)': { target: 6, lsl: 0, usl: 12, unit: 'hr' },
  'Filtration Pressure': { target: 3.0, lsl: 2.0, usl: 4.0, unit: 'bar' },
  'Filtration Pressure (bar) — Min': { target: 2.0, lsl: 2.0, usl: 4.0, unit: 'bar' },
  'Filtration Pressure (bar) — Max': { target: 4.0, lsl: 2.0, usl: 4.0, unit: 'bar' },
  'Filtration Yield': { target: 98, lsl: 96, usl: 100, unit: '%' },
  'Filtration Yield (%)': { target: 98, lsl: 96, usl: 100, unit: '%' },
  'Filling Yield': { target: 98.5, lsl: 97, usl: 100, unit: '%' },
  'Filling Yield (%)': { target: 98.5, lsl: 97, usl: 100, unit: '%' },
  'Nitrogen Pressure': { target: 2.75, lsl: 2.0, usl: 3.5, unit: 'kg/cm²' },
  'N₂ Pressure Pre-Fill (kg/cm²)': { target: 2.75, lsl: 2.0, usl: 3.5, unit: 'kg/cm²' },
  'Filling Speed': { target: 412.5, lsl: 275, usl: 550, unit: 'ampoules/min' },
  'Machine Speed (ampoules/min)': { target: 412.5, lsl: 275, usl: 550, unit: 'ampoules/min' },
  'Room Temperature': { target: 22, lsl: 0, usl: 25, unit: '°C' },
  'Relative Humidity': { target: 40, lsl: 0, usl: 55, unit: '%' },
  'Sterilization Temperature': { target: 121, lsl: 121, usl: 130, unit: '°C' },
  'Sterilization Temperature — MP (°C)': { target: 121, lsl: 121, usl: 130, unit: '°C' },
  'Sterilization Time': { target: 30, lsl: 30, usl: 60, unit: 'min' },
  'Sterilization Hold Time — MP (min)': { target: 30, lsl: 30, usl: 60, unit: 'min' },
};

export const ONDANSETRON_CQA_SPECS: Record<string, { target: number; lsl: number; usl: number; unit: string }> = {
  Assay: { target: 100, lsl: 95, usl: 105, unit: '%' },
  'Assay (%)': { target: 100, lsl: 97, usl: 103, unit: '%' },
  pH: { target: 3.65, lsl: 3.3, usl: 4.0, unit: '' },
  Description: { target: 1, lsl: 1, usl: 1, unit: 'Pass/Fail' },
  Identification: { target: 1, lsl: 1, usl: 1, unit: 'Complies/Does Not Comply' },
  'Extractable Volume': { target: 2.1, lsl: 2.0, usl: 2.5, unit: 'mL' },
  'Extractable Volume (mL)': { target: 2.1, lsl: 2.0, usl: 2.5, unit: 'mL' },
  'Bacterial Endotoxin': { target: 4.95, lsl: 0, usl: 9.9, unit: 'EU/mg' },
  'Bacterial Endotoxin (EU/mg)': { target: 4.95, lsl: 0, usl: 9.9, unit: 'EU/mg' },
  'Particulate Matter >=10µm': { target: 3000, lsl: 0, usl: 6000, unit: '/mL' },
  'Particulate Matter — ≥10 µm (/mL)': { target: 3000, lsl: 0, usl: 6000, unit: '/mL' },
  'Particulate Matter >=25µm': { target: 300, lsl: 0, usl: 600, unit: '/mL' },
  'Particulate Matter — ≥25 µm (/mL)': { target: 300, lsl: 0, usl: 600, unit: '/mL' },
  'Particulate Matter — Visible': { target: 0, lsl: 0, usl: 0, unit: 'count' },
  'Methyl Paraben': { target: 90, lsl: 80, usl: 100, unit: '%' },
  'Methyl Paraben Assay': { target: 90, lsl: 80, usl: 100, unit: '%' },
  'Preservative — Methyl Paraben (%)': { target: 90, lsl: 80, usl: 100, unit: '%' },
  'Propyl Paraben': { target: 90, lsl: 80, usl: 100, unit: '%' },
  'Propyl Paraben Assay': { target: 90, lsl: 80, usl: 100, unit: '%' },
  'Preservative — Propyl Paraben (%)': { target: 90, lsl: 80, usl: 100, unit: '%' },
  'Ondansetron Imp. D': { target: 0.06, lsl: 0, usl: 0.12, unit: '%' },
  'Ondansetron Imp. D (%)': { target: 0.06, lsl: 0, usl: 0.12, unit: '%' },
  'Any Secondary Impurity': { target: 0.1, lsl: 0, usl: 0.2, unit: '%' },
  'Any Secondary Impurity (%)': { target: 0.1, lsl: 0, usl: 0.2, unit: '%' },
  'Sum of All Impurities': { target: 0.25, lsl: 0, usl: 0.5, unit: '%' },
  'Sum of All Impurities (%)': { target: 0.25, lsl: 0, usl: 0.5, unit: '%' },
  'Total Viable Count': { target: 5, lsl: 0, usl: 10, unit: 'CFU/100 mL' },
  'Total Viable Count (CFU/100 mL)': { target: 5, lsl: 0, usl: 10, unit: 'CFU/100 mL' },
  'Colour Index': { target: 0.1, lsl: 0, usl: 0.2, unit: 'AU' },
  'Colour Index (AU)': { target: 0.1, lsl: 0, usl: 0.2, unit: 'AU' },
  'Weight per mL': { target: 1.025, lsl: 1.0, usl: 1.05, unit: 'g/mL' },
  'Weight per mL (g/mL)': { target: 1.025, lsl: 1.0, usl: 1.05, unit: 'g/mL' },
  Viscosity: { target: 1, lsl: 0.8, usl: 1.2, unit: 'cP' },
  'Preservative Content': { target: 90, lsl: 80, usl: 100, unit: '%' },
  'Extractable Vol (mL)': { target: 2.1, lsl: 2.0, usl: 2.5, unit: 'mL' },
  'Particulate Matter': { target: 0, lsl: 0, usl: 0, unit: 'count' },
  'Bacterial Endotoxin Test': { target: 4.95, lsl: 0, usl: 9.9, unit: 'EU/mg' },
  'Related Substance': { target: 0.25, lsl: 0, usl: 0.5, unit: '%' },
  'API Assay (ODB)': { target: 100, lsl: 98, usl: 102, unit: '%' },
  'Assay (ODB) (%)': { target: 100, lsl: 98, usl: 102, unit: '%' },
  'Water/ LOD': { target: 9.75, lsl: 9.0, usl: 10.5, unit: '%' },
  'Water / LOD': { target: 9.75, lsl: 9.0, usl: 10.5, unit: '%' },
  'Relative Substance': { target: 0.25, lsl: 0, usl: 0.5, unit: '%' },
  'Sum of Related Substances (%)': { target: 0.25, lsl: 0, usl: 0.5, unit: '%' },
};

/** Maps CQA test stage → BMR spec sections for Ondansetron. */
export const CQA_STAGE_TO_BMR_SECTIONS: Record<string, string[]> = {
  'In-Process Testing': ['BULK RESULTS'],
  'Finished Product Testing': ['FINISHED PRODUCT DATA'],
  'Raw Material Testing': ['STARTING MATERIAL (API)'],
};

const CQA_STAGE_BMR_PARAMETER_ALIASES: Record<string, string[]> = {
  ...CQA_PARAMETER_ALIASES,
  'Weight per mL': ['Weight per mL (g/mL)'],
  'Colour Index': ['Colour Index (AU)'],
  Assay: ['Assay (%)'],
  'Preservative Content': ['Preservative — Methyl Paraben (%)', 'Preservative — Propyl Paraben (%)'],
  'Extractable Vol (mL)': ['Extractable Volume (mL)'],
  'Particulate Matter': ['Particulate Matter — Visible'],
  'Bacterial Endotoxin Test': ['Bacterial Endotoxin (EU/mg)'],
  'Related Substance': ['Sum of All Impurities (%)', 'Ondansetron Imp. D (%)'],
  'API Assay (ODB)': ['Assay (ODB) (%)'],
  'Water/ LOD': ['Water / LOD'],
  'Relative Substance': ['Sum of Related Substances (%)'],
};

export interface OndansetronCqaOption extends CqaStageParameterOption {}

function cqaResultType(name: string): OndansetronCqaOption['resultType'] {
  const lower = name.toLowerCase();
  if (lower === 'description' || lower === 'sterility' || lower === 'particulate matter') return 'Pass/Fail';
  if (lower === 'identification') return 'Complies/Does Not Comply';
  return 'Numeric';
}

function cqaCriticality(name: string): OndansetronCqaOption['criticality'] {
  const n = name.toLowerCase();
  if (n.includes('assay') || n.includes('sterility') || n.includes('endotoxin')) return 'Critical';
  if (n.includes('impurity') || n.includes('imp.') || n.includes('particulate') || n.includes('related')) return 'Major';
  return 'Major';
}

function findBmrParameterForCanonical(canonicalName: string, sections: string[]): BmrSpecParameter | null {
  const aliases = CQA_STAGE_BMR_PARAMETER_ALIASES[canonicalName] || [canonicalName];
  for (const sec of ONDANSETRON_INJECTION_BMR_SPEC) {
    if (!sections.includes(sec.section)) continue;
    for (const param of sec.parameters) {
      if (aliases.some((alias) => cqaParameterNamesMatch(alias, param.parameter))) {
        return param;
      }
    }
  }
  return null;
}

function buildOndansetronCqaOption(
  canonicalName: string,
  testStage: string,
  bmr: BmrSpecParameter | null,
): OndansetronCqaOption {
  const code = canonicalName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 24);
  if (!bmr) {
    const spec = ONDANSETRON_CQA_SPECS[canonicalName];
    return {
      id: `bmr-cqa-${code}`,
      parameterName: canonicalName,
      parameterCode: `CQA_${code}`,
      section: testStage,
      responsibility: testStage === 'In-Process Testing' ? 'IPQA' : 'QA',
      specificationText: spec ? `${spec.lsl} – ${spec.usl} ${spec.unit}`.trim() : '',
      target: spec?.target ?? 0,
      lsl: spec?.lsl ?? 0,
      usl: spec?.usl ?? 0,
      unit: spec?.unit ?? '',
      resultType: cqaResultType(canonicalName),
      criticality: cqaCriticality(canonicalName),
    };
  }

  const parsed = parseBmrLimits(bmr.limits.lower, bmr.limits.upper);
  const alias = ONDANSETRON_CQA_SPECS[canonicalName] ?? ONDANSETRON_CQA_SPECS[bmr.parameter];
  return {
    id: `bmr-cqa-${code}`,
    parameterName: canonicalName,
    parameterCode: `CQA_${code}`,
    section: testStage,
    responsibility: bmr.responsibility,
    specificationText: parsed?.specification ?? `${bmr.limits.lower ?? '—'} / ${bmr.limits.upper ?? '—'}`,
    target: alias?.target ?? parsed?.target ?? 0,
    lsl: alias?.lsl ?? parsed?.lsl ?? 0,
    usl: alias?.usl ?? parsed?.usl ?? 0,
    unit: alias?.unit ?? parsed?.unit ?? '',
    resultType: cqaResultType(canonicalName),
    criticality: cqaCriticality(canonicalName),
  };
}

export function getOndansetronCqaOptionsForStage(testStage: string): OndansetronCqaOption[] {
  const sections = CQA_STAGE_TO_BMR_SECTIONS[testStage] || [];
  return getCqaParametersForStage(testStage).map((canonicalName) => {
    const bmr = findBmrParameterForCanonical(canonicalName, sections);
    return buildOndansetronCqaOption(canonicalName, testStage, bmr);
  });
}

export function resolveOndansetronCqaDefaults(parameterName: string): Partial<OndansetronCqaOption> | null {
  const spec = ONDANSETRON_CQA_SPECS[parameterName];
  const bmr = getBmrSpecParameter(parameterName);
  if (!spec && !bmr) return null;
  const parsed = bmr ? parseBmrLimits(bmr.limits.lower, bmr.limits.upper) : null;
  return {
    parameterName,
    responsibility: bmr?.responsibility ?? 'QA',
    specificationText: parsed?.specification ?? '',
    target: spec?.target ?? parsed?.target ?? 0,
    lsl: spec?.lsl ?? parsed?.lsl ?? 0,
    usl: spec?.usl ?? parsed?.usl ?? 0,
    unit: spec?.unit ?? parsed?.unit ?? '',
    resultType: cqaResultType(parameterName),
    criticality: cqaCriticality(parameterName),
  };
}
