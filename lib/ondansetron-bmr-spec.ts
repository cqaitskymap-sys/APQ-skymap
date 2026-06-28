/**
 * Ondansetron Injection BMR Specification
 * Source: data/Ondansetron_Injection_BMR_Specification_Corrected.xlsx
 */

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
    section: 'STERILIZATION & WASHING',
    parameters: [
      { srNo: 1, parameter: 'Cleaned MP Hold Time (hr)', limits: { lower: null, upper: 'NMT 24' }, responsibility: 'Production', remarks: 'Machine Parts' },
      { srNo: 2, parameter: 'Sterilization Temperature — MP (°C)', limits: { lower: 'NLT 121', upper: null }, responsibility: 'Production', remarks: 'Machine Parts' },
      { srNo: 3, parameter: 'Sterilization Hold Time — MP (min)', limits: { lower: 'NLT 30', upper: null }, responsibility: 'Production', remarks: 'Machine Parts' },
      { srNo: 4, parameter: 'Sterilization Temperature — MV (°C)', limits: { lower: 'NLT 121', upper: null }, responsibility: 'Production', remarks: 'Mixing Vessel' },
      { srNo: 5, parameter: 'Sterilization Hold Time — MV (min)', limits: { lower: 'NLT 30', upper: null }, responsibility: 'Production', remarks: 'Mixing Vessel' },
      { srNo: 6, parameter: 'Sterilization Temperature — HV/BV (°C)', limits: { lower: 'NLT 121', upper: null }, responsibility: 'Production', remarks: 'Holding / Buffer Vessel' },
      { srNo: 7, parameter: 'Sterilization Hold Time — HV/BV (min)', limits: { lower: 'NLT 30', upper: null }, responsibility: 'Production', remarks: 'Holding / Buffer Vessel' },
      { srNo: 8, parameter: 'Glass Wash — Compressed Air Pressure (bar)', limits: { lower: 'NLT 2.0', upper: 'NMT 4.0' }, responsibility: 'Production' },
      { srNo: 9, parameter: 'Glass Wash — Recycled WFI Pressure (bar)', limits: { lower: 'NLT 1.5', upper: 'NMT 3.0' }, responsibility: 'Production' },
      { srNo: 10, parameter: 'Glass Wash — Fresh WFI Pressure (bar)', limits: { lower: 'NLT 1.5', upper: 'NMT 3.0' }, responsibility: 'Production' },
    ],
  },
  {
    section: 'GLASS CONTAINER DEPYROGENATION & MIXING',
    parameters: [
      { srNo: 1, parameter: 'Preheat Zone DP (Pa)', limits: { lower: 'NLT 10', upper: 'NMT 30' }, responsibility: 'Production' },
      { srNo: 2, parameter: 'Preheat Zone Temperature (°C)', limits: { lower: 'NLT 100', upper: 'NMT 200' }, responsibility: 'Production' },
      { srNo: 3, parameter: 'Heating Zone DP (Pa)', limits: { lower: 'NLT 10', upper: 'NMT 30' }, responsibility: 'Production' },
      { srNo: 4, parameter: 'Heating Zone Temperature (°C)', limits: { lower: 'NLT 280', upper: 'NMT 320' }, responsibility: 'Production' },
      { srNo: 5, parameter: 'Cooling Zone DP (Pa)', limits: { lower: 'NLT 10', upper: 'NMT 30' }, responsibility: 'Production' },
      { srNo: 6, parameter: 'Cooling Zone Temperature (°C)', limits: { lower: 'NLT 20', upper: 'NMT 80' }, responsibility: 'Production' },
      { srNo: 7, parameter: 'Mixing RPM', limits: { lower: 'NLT 250', upper: 'NMT 400' }, responsibility: 'IPQA' },
      { srNo: 8, parameter: 'Mixing Time (min)', limits: { lower: 'NLT 12', upper: 'NMT 18' }, responsibility: 'IPQA', remarks: 'Range per BMR' },
      { srNo: 9, parameter: 'Bulk Hold Time (hr)', limits: { lower: null, upper: 'NMT 12' }, responsibility: 'IPQA' },
    ],
  },
  {
    section: 'BULK RESULTS',
    parameters: [
      { srNo: 1, parameter: 'Description', limits: { lower: 'Clear Solution', upper: 'Clear Solution' }, responsibility: 'IPQA' },
      { srNo: 2, parameter: 'pH', limits: { lower: 3.5, upper: 3.8 }, responsibility: 'IPQA' },
      { srNo: 3, parameter: 'Assay (%)', limits: { lower: 97, upper: 103 }, responsibility: 'IPQA' },
      { srNo: 4, parameter: 'Total Viable Count (CFU/100 mL)', limits: { lower: null, upper: 'NMT 10' }, responsibility: 'IPQA', remarks: 'Per sterile bulk spec' },
      { srNo: 5, parameter: 'Colour Index (AU)', limits: { lower: null, upper: 'NMT 0.200' }, responsibility: 'IPQA' },
    ],
  },
  {
    section: 'FILTRATION PROCESS',
    parameters: [
      { srNo: 1, parameter: 'Filter Make', limits: { lower: 'Sartorius', upper: 'Sartorius' }, responsibility: 'Production' },
      { srNo: 2, parameter: 'Integrity Test BPT (mbar)', limits: { lower: 'NLT 3172', upper: 'NMT 5000' }, responsibility: 'IPQA' },
      { srNo: 3, parameter: 'Filtration Pressure (bar) — Min', limits: { lower: 'NLT 2.0', upper: null }, responsibility: 'IPQA', remarks: 'Record at defined frequency throughout filtration' },
      { srNo: 4, parameter: 'Filtration Pressure (bar) — Max', limits: { lower: null, upper: 'NMT 4.0' }, responsibility: 'IPQA', remarks: 'Upper limit for OOT/OOS' },
      { srNo: 5, parameter: 'Filtration Yield (%)', limits: { lower: 96, upper: null }, responsibility: 'IPQA' },
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
      { srNo: 6, parameter: 'Filling Time (hr)', limits: { lower: null, upper: 'NMT 24' }, responsibility: 'IPQA' },
      { srNo: 7, parameter: 'Max Filled Nos. (calc.)', limits: { lower: null, upper: 792_000 }, responsibility: 'IPQA', remarks: '≤ speed × 60 × filling hrs (550×60×24)' },
      { srNo: 8, parameter: 'Filling Yield (%)', limits: { lower: 97, upper: 100 }, responsibility: 'IPQA' },
    ],
  },
  {
    section: 'FINISHED PRODUCT DATA',
    parameters: [
      { srNo: 1, parameter: 'pH', limits: { lower: 3.300, upper: 4.000 }, responsibility: 'QA' },
      { srNo: 2, parameter: 'Extractable Volume (mL)', limits: { lower: 'NLT 2.0', upper: null }, responsibility: 'QA' },
      { srNo: 3, parameter: 'Particulate Matter — Visible', limits: { lower: 0, upper: 0 }, responsibility: 'QA' },
      { srNo: 4, parameter: 'Particulate Matter — ≥10 µm (/mL)', limits: { lower: null, upper: 'NMT 6000' }, responsibility: 'QA' },
      { srNo: 5, parameter: 'Particulate Matter — ≥25 µm (/mL)', limits: { lower: null, upper: 'NMT 600' }, responsibility: 'QA' },
      { srNo: 6, parameter: 'Bacterial Endotoxin (EU/mg)', limits: { lower: null, upper: 'NMT 9.9' }, responsibility: 'QA' },
      { srNo: 7, parameter: 'Ondansetron Imp. D (%)', limits: { lower: null, upper: 'NMT 0.12' }, responsibility: 'QA' },
      { srNo: 8, parameter: 'Any Secondary Impurity (%)', limits: { lower: null, upper: 'NMT 0.2' }, responsibility: 'QA' },
      { srNo: 9, parameter: 'Sum of All Impurities (%)', limits: { lower: null, upper: 'NMT 0.5' }, responsibility: 'QA' },
      { srNo: 10, parameter: 'Assay (%)', limits: { lower: 95, upper: 105 }, responsibility: 'QA' },
      { srNo: 11, parameter: 'Preservative — Methyl Paraben (%)', limits: { lower: 'NLT 80', upper: null }, responsibility: 'QA', remarks: '≥80% of label claim' },
      { srNo: 12, parameter: 'Preservative — Propyl Paraben (%)', limits: { lower: 'NLT 80', upper: null }, responsibility: 'QA', remarks: '≥80% of label claim' },
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
    'DISPENSING', 'STERILIZATION & WASHING', 'GLASS CONTAINER DEPYROGENATION & MIXING',
    'FILTRATION PROCESS', 'FILLING PROCESS',
  ];
  return ONDANSETRON_INJECTION_BMR_SPEC
    .filter((s) => sections.includes(s.section))
    .flatMap((s) => s.parameters.map((p) => p.parameter));
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
  'Fill Volume': { target: 2.15, lsl: 2.1, usl: 2.2, unit: 'mL' },
  'Mixing Time': { target: 15, lsl: 12, usl: 18, unit: 'min' },
  'Mixing RPM': { target: 325, lsl: 250, usl: 400, unit: 'RPM' },
  'Bulk Hold Time': { target: 6, lsl: 0, usl: 12, unit: 'hr' },
  'Filtration Pressure': { target: 3.0, lsl: 2.0, usl: 4.0, unit: 'bar' },
  'Filtration Yield': { target: 98, lsl: 96, usl: 100, unit: '%' },
  'Filling Yield': { target: 98.5, lsl: 97, usl: 100, unit: '%' },
  'Nitrogen Pressure': { target: 2.75, lsl: 2.0, usl: 3.5, unit: 'kg/cm²' },
  'Filling Speed': { target: 412.5, lsl: 275, usl: 550, unit: 'ampoules/min' },
  'Room Temperature': { target: 22, lsl: 0, usl: 25, unit: '°C' },
  'Relative Humidity': { target: 40, lsl: 0, usl: 55, unit: '%' },
  'Sterilization Temperature': { target: 121, lsl: 121, usl: 130, unit: '°C' },
  'Sterilization Time': { target: 30, lsl: 30, usl: 60, unit: 'min' },
};

export const ONDANSETRON_CQA_SPECS: Record<string, { target: number; lsl: number; usl: number; unit: string }> = {
  Assay: { target: 100, lsl: 95, usl: 105, unit: '%' },
  'Assay (%)': { target: 100, lsl: 97, usl: 103, unit: '%' },
  pH: { target: 3.65, lsl: 3.3, usl: 4.0, unit: '' },
  Description: { target: 1, lsl: 1, usl: 1, unit: 'Pass/Fail' },
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
};

/** Maps CQA test stage → BMR spec sections for Ondansetron. */
export const CQA_STAGE_TO_BMR_SECTIONS: Record<string, string[]> = {
  'In-Process Testing': ['BULK RESULTS'],
  'Finished Product Testing': ['FINISHED PRODUCT DATA'],
  'Related Substance Testing': ['STARTING MATERIAL (API)', 'FINISHED PRODUCT DATA'],
  'Endotoxin Testing': ['FINISHED PRODUCT DATA'],
  'Particulate Matter Testing': ['FINISHED PRODUCT DATA'],
  'Preservative Testing': ['FINISHED PRODUCT DATA'],
  'Microbiology Testing': ['BULK RESULTS'],
  'Assay Testing': ['BULK RESULTS', 'FINISHED PRODUCT DATA'],
  'Sterility Testing': ['FINISHED PRODUCT DATA'],
  'Identification Testing': ['STARTING MATERIAL (API)'],
  'Stability Testing': ['FINISHED PRODUCT DATA'],
};

export interface OndansetronCqaOption {
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
  resultType: 'Numeric' | 'Pass/Fail' | 'Complies/Does Not Comply';
  criticality: 'Critical' | 'Major' | 'Minor';
}

function cqaResultType(name: string): OndansetronCqaOption['resultType'] {
  if (name === 'Description' || name.startsWith('Particulate Matter — Visible')) return 'Pass/Fail';
  return 'Numeric';
}

function cqaCriticality(name: string): OndansetronCqaOption['criticality'] {
  const n = name.toLowerCase();
  if (n.includes('assay') || n.includes('sterility') || n.includes('endotoxin')) return 'Critical';
  if (n.includes('impurity') || n.includes('imp.') || n.includes('particulate')) return 'Major';
  return 'Major';
}

export function getOndansetronCqaOptionsForStage(testStage: string): OndansetronCqaOption[] {
  const sections = CQA_STAGE_TO_BMR_SECTIONS[testStage]
    || ['BULK RESULTS', 'FINISHED PRODUCT DATA'];
  const options: OndansetronCqaOption[] = [];

  for (const sec of ONDANSETRON_INJECTION_BMR_SPEC) {
    if (!sections.includes(sec.section)) continue;
    for (const p of sec.parameters) {
      const parsed = parseBmrLimits(p.limits.lower, p.limits.upper);
      const alias = ONDANSETRON_CQA_SPECS[p.parameter];
      const code = p.parameter.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 24);
      options.push({
        id: `bmr-cqa-${code}`,
        parameterName: p.parameter,
        parameterCode: `CQA_${code}`,
        section: sec.section,
        responsibility: p.responsibility,
        specificationText: parsed?.specification ?? `${p.limits.lower ?? '—'} / ${p.limits.upper ?? '—'}`,
        target: alias?.target ?? parsed?.target ?? 0,
        lsl: alias?.lsl ?? parsed?.lsl ?? 0,
        usl: alias?.usl ?? parsed?.usl ?? 0,
        unit: alias?.unit ?? parsed?.unit ?? '',
        resultType: cqaResultType(p.parameter),
        criticality: cqaCriticality(p.parameter),
      });
    }
  }
  return options;
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
