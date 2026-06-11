import type { CppRecord, CqaRecord, RiskRecord } from './cpv';
import { calculateCapability, calculateControlLimits, displayCpvStatus } from './cpv';
import { buildRiskReport } from './cpv-risk-report';

export type AnnualCpvWorkflowStatus = 'draft' | 'under_review' | 'approved' | 'archived';

export interface AnnualCpvSectionSummary {
  total: number;
  open?: number;
  complies?: number;
  oot?: number;
  oos?: number;
  summary: string;
  records?: Record<string, unknown>[];
}

export interface AnnualCpvCapabilityItem {
  parameter: string;
  source: 'CPP' | 'CQA';
  count: number;
  cpk: number;
  ppk: number;
  status: string;
}

export interface AnnualCpvSnapshot {
  reviewYear: number;
  generatedAt: string;
  productFilter: string;
  cpp: AnnualCpvSectionSummary;
  cqa: AnnualCpvSectionSummary;
  capability: {
    averageCpk: number;
    averagePpk: number;
    items: AnnualCpvCapabilityItem[];
    controlViolations: number;
    summary: string;
  };
  trend: {
    oot: number;
    oos: number;
    totalObservations: number;
    summary: string;
  };
  risk: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    summary: string;
  };
  deviations: AnnualCpvSectionSummary;
  oos: AnnualCpvSectionSummary;
  capa: AnnualCpvSectionSummary;
  changeControl: AnnualCpvSectionSummary;
  batches: {
    total: number;
    manufactured: number;
    released: number;
    rejected: number;
    records: Record<string, unknown>[];
    summary: string;
  };
  equipment: AnnualCpvSectionSummary;
  executiveSummary: string;
  conclusion: string;
  recommendations: string;
}

export interface AnnualCpvSignature {
  role: 'prepared' | 'reviewed' | 'approved';
  designation: string;
  name: string;
  signatureText: string;
  signedAt: string | null;
  userId?: string;
  meaning?: string;
  reason?: string;
}

export interface AnnualCpvDocument {
  id?: string;
  documentNumber: string;
  reviewYear: number;
  productName: string;
  status: AnnualCpvWorkflowStatus;
  conclusion: string;
  recommendations: string;
  preparedBy: string;
  preparedById: string;
  signatures: AnnualCpvSignature[];
  snapshot: AnnualCpvSnapshot;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export const DEFAULT_ANNUAL_CPV_SIGNATURES: AnnualCpvSignature[] = [
  { role: 'prepared', designation: 'CPV Coordinator / QA Executive', name: '', signatureText: '', signedAt: null },
  { role: 'reviewed', designation: 'QA Manager', name: '', signatureText: '', signedAt: null },
  { role: 'approved', designation: 'Head QA', name: '', signatureText: '', signedAt: null },
];

function inYear(dateStr: string | undefined, year: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
}

function pickDate(record: Record<string, unknown>): string {
  return String(
    record.createdAt || record.created_at || record.manufacturingDate
    || record.manufacturing_date || record.testDate || record.test_date || '',
  );
}

function countOpen(records: Record<string, unknown>[]): number {
  return records.filter((r) => {
    const s = String(r.status || r.workflow_status || '').toLowerCase();
    return s.includes('open') || s.includes('draft') || s.includes('pending') || s.includes('investigation');
  }).length;
}

function countCppCqa(records: Array<{ status?: string }>) {
  let complies = 0; let oot = 0; let oos = 0;
  records.forEach((r) => {
    const display = displayCpvStatus(r.status || '');
    if (display === 'Pass') complies++;
    else if (display === 'OOT') oot++;
    else oos++;
  });
  return { complies, oot, oos };
}

export function buildAnnualCpvSnapshot(input: {
  year: number;
  productFilter?: string;
  cpp: CppRecord[];
  cqa: CqaRecord[];
  risks: RiskRecord[];
  deviations: Record<string, unknown>[];
  oos: Record<string, unknown>[];
  capa: Record<string, unknown>[];
  changeControl: Record<string, unknown>[];
  batches: Record<string, unknown>[];
  equipment: Record<string, unknown>[];
}): AnnualCpvSnapshot {
  const productFilter = input.productFilter || 'all';
  const matchProduct = (r: Record<string, unknown>) => {
    if (productFilter === 'all') return true;
    const p = String(r.productName || r.product_name || r.product || '');
    return p === productFilter;
  };

  const cppYear = input.cpp.filter((r) => inYear(r.createdAt || r.manufacturingDate, input.year));
  const cqaYear = input.cqa.filter((r) => inYear(r.testDate || r.createdAt, input.year));
  const riskYear = input.risks.filter((r) => inYear(r.createdAt, input.year));

  const deviations = input.deviations.filter((r) => inYear(pickDate(r), input.year) && matchProduct(r));
  const oosEvents = input.oos.filter((r) => inYear(pickDate(r), input.year) && matchProduct(r));
  const capa = input.capa.filter((r) => inYear(pickDate(r), input.year) && matchProduct(r));
  const changeControl = input.changeControl.filter((r) => inYear(pickDate(r), input.year) && matchProduct(r));
  const batches = input.batches.filter((r) => inYear(pickDate(r), input.year) && matchProduct(r));
  const equipment = input.equipment.filter((r) => inYear(pickDate(r), input.year) || input.year === new Date().getFullYear());

  const cppStats = countCppCqa(cppYear);
  const cqaStats = countCppCqa(cqaYear);
  const allCpv = [...cppYear, ...cqaYear];
  const oot = allCpv.filter((r) => r.status === 'OOT').length;
  const oos = allCpv.filter((r) => r.status === 'OOS').length;

  const grouped = new Map<string, Array<CppRecord | CqaRecord>>();
  allCpv.forEach((record) => {
    const key = `${'parameterName' in record ? 'CPP' : 'CQA'}::${'parameterName' in record ? record.parameterName : record.testParameter}`;
    grouped.set(key, [...(grouped.get(key) || []), record]);
  });

  const capabilityItems: AnnualCpvCapabilityItem[] = Array.from(grouped.entries())
    .map(([key, records]) => {
      const [source, parameter] = key.split('::') as ['CPP' | 'CQA', string];
      const cap = calculateCapability(records.map((r) => r.observedValue), records[0].lsl, records[0].usl);
      return {
        parameter,
        source,
        count: cap.count,
        cpk: cap.cpk,
        ppk: cap.ppk,
        status: cap.status,
      };
    })
    .filter((item) => item.count >= 2);

  const validCaps = capabilityItems.filter((i) => i.status !== 'Insufficient Data');
  const averageCpk = validCaps.length
    ? validCaps.reduce((s, i) => s + i.cpk, 0) / validCaps.length
    : 0;
  const averagePpk = validCaps.length
    ? validCaps.reduce((s, i) => s + i.ppk, 0) / validCaps.length
    : 0;

  const controlViolations = Array.from(grouped.values()).reduce(
    (sum, records) => sum + calculateControlLimits(records.map((r) => r.observedValue)).points.filter((p) => p.outOfControl).length,
    0,
  );

  const riskReport = buildRiskReport(riskYear);
  const criticalRisks = riskYear.filter((r) => r.riskLevel === 'Critical').length;
  const highRisks = riskYear.filter((r) => r.riskLevel === 'High').length;

  const released = batches.filter((b) => String(b.status || b.batch_status || '').toLowerCase().includes('release')).length;
  const rejected = batches.filter((b) => String(b.status || b.batch_status || '').toLowerCase().includes('reject')).length;

  const equipmentQualified = equipment.filter((e) =>
    String(e.status || e.qualification_status || '').toLowerCase().includes('qual'),
  ).length;

  const stable = oos === 0 && criticalRisks === 0 && controlViolations === 0
    && (validCaps.length === 0 || averageCpk >= 1);

  const executiveSummary = `Annual Continued Process Verification review for calendar year ${input.year}. `
    + `${cppYear.length} CPP and ${cqaYear.length} CQA observations were evaluated. `
    + `Quality system integration captured ${deviations.length} deviation(s), ${oosEvents.length} OOS investigation(s), `
    + `${capa.length} CAPA record(s), and ${changeControl.length} change control record(s). `
    + `${batches.length} batch record(s) and ${equipment.length} equipment qualification record(s) were reviewed. `
    + `Process capability average Cpk was ${averageCpk.toFixed(2)} with ${controlViolations} control-chart special-cause signal(s).`;

  const conclusion = stable
    ? 'Based on the aggregated CPP, CQA, capability, trend, risk, and quality system data, the manufacturing process remains in a state of statistical control and continued process verification supports ongoing commercial manufacturing under the approved control strategy.'
    : 'The annual CPV review identifies signals requiring enhanced monitoring, investigation, or corrective action. OOS events, elevated risk assessments, capability concerns, or control-chart violations should be formally linked to deviation, OOS, and CAPA workflows.';

  const recommendations = stable
    ? 'Continue routine CPP and CQA monitoring per the approved CPV plan. Maintain batch-wise data collection, capability assessment, and annual CPV review. No immediate change to the control strategy is recommended.'
    : 'Implement targeted CAPA for identified OOS/OOT trends. Review control limits and sampling plans. Escalate high/critical CPV risk assessments. Update validation or requalification commitments where equipment or process drift is evident.';

  return {
    reviewYear: input.year,
    generatedAt: new Date().toISOString(),
    productFilter,
    cpp: {
      total: cppYear.length,
      ...cppStats,
      summary: `CPP monitoring: ${cppStats.complies} pass, ${cppStats.oot} OOT, ${cppStats.oos} OOS from ${cppYear.length} observations.`,
      records: cppYear.slice(0, 20) as unknown as Record<string, unknown>[],
    },
    cqa: {
      total: cqaYear.length,
      ...cqaStats,
      summary: `CQA monitoring: ${cqaStats.complies} pass, ${cqaStats.oot} OOT, ${cqaStats.oos} OOS from ${cqaYear.length} results.`,
      records: cqaYear.slice(0, 20) as unknown as Record<string, unknown>[],
    },
    capability: {
      averageCpk: Number(averageCpk.toFixed(3)),
      averagePpk: Number(averagePpk.toFixed(3)),
      items: capabilityItems,
      controlViolations,
      summary: validCaps.length
        ? `Capability assessed for ${validCaps.length} parameter(s). Average Cpk ${averageCpk.toFixed(2)}, average Ppk ${averagePpk.toFixed(2)}.`
        : 'Insufficient repeated parameter data for formal capability assessment.',
    },
    trend: {
      oot,
      oos,
      totalObservations: allCpv.length,
      summary: `Trend review of ${allCpv.length} CPP/CQA observations identified ${oot} OOT and ${oos} OOS results.`,
    },
    risk: {
      total: riskYear.length,
      critical: criticalRisks,
      high: highRisks,
      medium: riskReport.byLevel.Medium,
      low: riskReport.byLevel.Low,
      summary: `${riskYear.length} CPV risk assessment(s) reviewed; ${criticalRisks} critical and ${highRisks} high risk rating(s).`,
    },
    deviations: {
      total: deviations.length,
      open: countOpen(deviations),
      summary: `${deviations.length} deviation(s) within review period; ${countOpen(deviations)} open.`,
      records: deviations.slice(0, 15),
    },
    oos: {
      total: oosEvents.length,
      open: countOpen(oosEvents),
      summary: `${oosEvents.length} OOS investigation(s); ${countOpen(oosEvents)} open.`,
      records: oosEvents.slice(0, 15),
    },
    capa: {
      total: capa.length,
      open: countOpen(capa),
      summary: `${capa.length} CAPA record(s); ${countOpen(capa)} open.`,
      records: capa.slice(0, 15),
    },
    changeControl: {
      total: changeControl.length,
      open: countOpen(changeControl),
      summary: `${changeControl.length} change control record(s) reviewed.`,
      records: changeControl.slice(0, 15),
    },
    batches: {
      total: batches.length,
      manufactured: batches.length,
      released: released || Math.max(0, batches.length - rejected),
      rejected,
      records: batches.slice(0, 20),
      summary: `${batches.length} batch(es) in scope; ${released || 0} released, ${rejected} rejected.`,
    },
    equipment: {
      total: equipment.length,
      open: equipment.length - equipmentQualified,
      summary: equipment.length
        ? `${equipmentQualified} of ${equipment.length} equipment record(s) within qualified/calibrated status.`
        : 'Equipment qualification data reviewed; maintain calibration and requalification per schedule.',
      records: equipment.slice(0, 15),
    },
    executiveSummary,
    conclusion,
    recommendations,
  };
}

export function generateAnnualCpvNumber(year: number, existingCount: number): string {
  return `ACPV/${year}/${String(existingCount + 1).padStart(3, '0')}`;
}

export function workflowStatusLabel(status: AnnualCpvWorkflowStatus): string {
  const map: Record<AnnualCpvWorkflowStatus, string> = {
    draft: 'Draft',
    under_review: 'Under Review',
    approved: 'Approved',
    archived: 'Archived',
  };
  return map[status];
}
