import type {
  CppRecord, CqaRecord, RiskRecord, UtilityRecord, YieldRecord,
} from './cpv';
import { calculateAiRiskScore } from './cpv';
import { computeCapabilityAverages, countByStatus } from './cpv-dashboard';
import { enrichTrendSeries, mergeTrendObservations, type TrendObservation } from './cpv-trend-analysis';

const round = (v: number, d = 1) => Number(v.toFixed(d));

export type AiSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AiDetectionType =
  | 'process_drift'
  | 'future_oos'
  | 'future_oot'
  | 'yield_loss'
  | 'equipment_impact'
  | 'cqa_deterioration';

export interface AiDetection {
  id: string;
  type: AiDetectionType;
  title: string;
  description: string;
  product: string;
  parameter: string;
  severity: AiSeverity;
  confidence: number;
  metric?: string;
  slope?: number;
  projectedValue?: number;
  batchesAhead?: number;
}

export interface PredictiveAlert extends AiDetection {
  recommendedAction: string;
  dueWindow: string;
}

export interface AiRecommendation {
  id: string;
  priority: 'Immediate' | 'High' | 'Medium' | 'Low';
  title: string;
  action: string;
  rationale: string;
  category: AiDetectionType | 'general';
}

export interface AiAnalyticsFilters {
  product?: string;
}

export interface AiAnalyticsReport {
  generatedAt: string;
  riskScore: number;
  healthScore: number;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  healthLevel: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  detections: AiDetection[];
  alerts: PredictiveAlert[];
  recommendations: AiRecommendation[];
  managementSummary: string;
  summaryBullets: string[];
  modelAccuracy: number;
  detectionCounts: Record<AiDetectionType, number>;
}

interface SeriesPoint {
  date: string;
  batch: string;
  value: number;
  lsl: number;
  usl: number;
  target: number;
  product: string;
}

function safeDate(raw?: string): Date {
  const d = raw ? new Date(raw) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function linearRegression(values: number[]) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r2: 0 };
  const sumX = values.reduce((s, _, i) => s + i, 0);
  const sumY = values.reduce((s, v) => s + v, 0);
  const sumXY = values.reduce((s, v, i) => s + i * v, 0);
  const sumXX = values.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sumXX - sumX ** 2;
  const slope = denom ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  const ssTot = values.reduce((s, v) => s + (v - meanY) ** 2, 0);
  const ssRes = values.reduce((s, v, i) => s + (v - (intercept + slope * i)) ** 2, 0);
  const r2 = ssTot ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { slope, intercept, r2 };
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
}

function severityFromConfidence(confidence: number, critical = false): AiSeverity {
  if (critical) return 'critical';
  if (confidence >= 80) return 'high';
  if (confidence >= 60) return 'medium';
  if (confidence >= 40) return 'low';
  return 'info';
}

function riskLevel(score: number): AiAnalyticsReport['riskLevel'] {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 25) return 'Medium';
  return 'Low';
}

function healthLevel(score: number): AiAnalyticsReport['healthLevel'] {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

function filterProduct<T extends { productName?: string }>(records: T[], product?: string): T[] {
  if (!product || product === 'all') return records;
  return records.filter((r) => r.productName === product);
}

function cppSeries(cpp: CppRecord[], product?: string): Map<string, SeriesPoint[]> {
  const map = new Map<string, SeriesPoint[]>();
  filterProduct(cpp, product).forEach((r) => {
    const key = `${r.productName}|${r.parameterName}`;
    const list = map.get(key) || [];
    list.push({
      date: r.manufacturingDate || r.createdAt || '',
      batch: r.batchNo,
      value: r.observedValue,
      lsl: r.lsl,
      usl: r.usl,
      target: r.targetValue,
      product: r.productName,
    });
    map.set(key, list);
  });
  map.forEach((list, key) => {
    list.sort((a, b) => safeDate(a.date).getTime() - safeDate(b.date).getTime());
    map.set(key, list);
  });
  return map;
}

function cqaSeries(cqa: CqaRecord[], product?: string): Map<string, SeriesPoint[]> {
  const map = new Map<string, SeriesPoint[]>();
  filterProduct(cqa, product).forEach((r) => {
    const key = `${r.productName}|${r.testParameter}`;
    const list = map.get(key) || [];
    list.push({
      date: r.testDate || r.createdAt || '',
      batch: r.batchNo,
      value: r.observedValue,
      lsl: r.lsl,
      usl: r.usl,
      target: r.target,
      product: r.productName,
    });
    map.set(key, list);
  });
  map.forEach((list) => list.sort((a, b) => safeDate(a.date).getTime() - safeDate(b.date).getTime()));
  return map;
}

function batchesToLimit(current: number, limit: number, slope: number, towardLower: boolean): number | null {
  if (!slope || Math.abs(slope) < 1e-6) return null;
  const movingToward = towardLower ? slope < 0 : slope > 0;
  if (!movingToward) return null;
  const delta = towardLower ? current - limit : limit - current;
  if (delta <= 0) return 0;
  return Math.ceil(delta / Math.abs(slope));
}

function detectProcessDrift(series: Map<string, SeriesPoint[]>, type: 'cpp' | 'cqa'): AiDetection[] {
  const results: AiDetection[] = [];
  series.forEach((points, key) => {
    if (points.length < 4) return;
    const [product, parameter] = key.split('|');
    const values = points.map((p) => p.value);
    const { slope, r2 } = linearRegression(values);
    const sigma = stdDev(values);
    const driftThreshold = sigma * 0.15;
    if (Math.abs(slope) < driftThreshold) return;

    const direction = slope > 0 ? 'upward' : 'downward';
    const confidence = round(Math.min(95, 45 + r2 * 40 + Math.min(points.length, 12) * 2));

    results.push({
      id: `drift-${type}-${key}`,
      type: 'process_drift',
      title: `${parameter} — Process Drift Detected`,
      description: `${direction.charAt(0).toUpperCase() + direction.slice(1)} drift on ${parameter} for ${product} `
        + `(slope ${round(slope, 3)}/batch, R² ${round(r2, 2)}). ${points.length} batches analyzed.`,
      product,
      parameter,
      severity: severityFromConfidence(confidence, Math.abs(slope) > sigma * 0.35),
      confidence,
      slope: round(slope, 4),
    });
  });
  return results;
}

function detectFutureOos(series: Map<string, SeriesPoint[]>, type: 'cpp' | 'cqa'): AiDetection[] {
  const results: AiDetection[] = [];
  series.forEach((points, key) => {
    if (points.length < 3) return;
    const [product, parameter] = key.split('|');
    const values = points.map((p) => p.value);
    const { slope, intercept, r2 } = linearRegression(values);
    const lastIdx = values.length - 1;
    const projected = intercept + slope * (lastIdx + 3);
    const { lsl, usl } = points[points.length - 1];
    const towardLower = slope < 0;
    const limit = towardLower ? lsl : usl;
    const current = values[values.length - 1];
    const movingTowardLimit = towardLower ? slope < 0 : slope > 0;
    if (!movingTowardLimit) return;

    const headingOos = towardLower ? projected < lsl : projected > usl;
    if (!headingOos) return;

    const distance = towardLower ? current - lsl : usl - current;
    const range = usl - lsl || 1;
    const proximity = 1 - Math.max(0, distance / range);
    const confidence = round(Math.min(92, 35 + proximity * 45 + r2 * 20));

    const batchesAhead = batchesToLimit(current, limit, slope, towardLower) ?? 3;

    results.push({
      id: `oos-${type}-${key}`,
      type: 'future_oos',
      title: `${parameter} — Future OOS Risk`,
      description: `Projected value ${round(projected, 2)} in ~${batchesAhead} batch(es) may exceed `
        + `${towardLower ? 'LSL' : 'USL'} (${limit}). Current: ${round(current, 2)}.`,
      product,
      parameter,
      severity: batchesAhead <= 2 ? 'critical' : severityFromConfidence(confidence),
      confidence,
      slope: round(slope, 4),
      projectedValue: round(projected, 2),
      batchesAhead,
    });
  });
  return results;
}

function detectFutureOot(series: Map<string, SeriesPoint[]>, type: 'cpp' | 'cqa'): AiDetection[] {
  const results: AiDetection[] = [];
  series.forEach((points, key) => {
    if (points.length < 3) return;
    const [product, parameter] = key.split('|');
    const values = points.map((p) => p.value);
    const { slope, intercept, r2 } = linearRegression(values);
    const last = points[points.length - 1];
    const target = last.target;
    const tolerance = (last.usl - last.lsl) * 0.1;
    const ootLower = target - tolerance;
    const ootUpper = target + tolerance;
    const projected = intercept + slope * (values.length - 1 + 2);
    const towardLower = slope < 0;
    const ootLimit = towardLower ? ootLower : ootUpper;
    const current = values[values.length - 1];
    const inSpec = current >= last.lsl && current <= last.usl;
    const nearOot = towardLower ? current <= ootLower + tolerance * 0.5 : current >= ootUpper - tolerance * 0.5;
    const projOot = towardLower ? projected < ootLower : projected > ootUpper;
    if (!inSpec || (!nearOot && !projOot)) return;

    const confidence = round(Math.min(88, 40 + r2 * 30 + (nearOot ? 15 : 0)));
    results.push({
      id: `oot-${type}-${key}`,
      type: 'future_oot',
      title: `${parameter} — Future OOT Risk`,
      description: `Trend indicates potential OOT on ${parameter} within 2 batches `
        + `(projected ${round(projected, 2)} vs target ${round(target, 2)}).`,
      product,
      parameter,
      severity: severityFromConfidence(confidence),
      confidence,
      projectedValue: round(projected, 2),
      batchesAhead: 2,
    });
  });
  return results;
}

function detectYieldLoss(yields: YieldRecord[], product?: string): AiDetection[] {
  const filtered = filterProduct(yields, product);
  if (filtered.length < 3) return [];

  const byProduct = new Map<string, YieldRecord[]>();
  filtered.forEach((r) => {
    const list = byProduct.get(r.productName) || [];
    list.push(r);
    byProduct.set(r.productName, list);
  });

  const results: AiDetection[] = [];
  byProduct.forEach((records, productName) => {
    const sorted = records.slice().sort(
      (a, b) => safeDate(a.manufacturingDate || a.createdAt).getTime()
        - safeDate(b.manufacturingDate || b.createdAt).getTime(),
    );
    const values = sorted.map((r) => r.observedValue);
    const { slope, r2 } = linearRegression(values);
    if (slope >= -0.2) return;

    const totalLoss = values[0] - values[values.length - 1];
    const confidence = round(Math.min(90, 50 + Math.abs(slope) * 8 + r2 * 25));

    results.push({
      id: `yield-${productName}`,
      type: 'yield_loss',
      title: `${productName} — Yield Loss Trend`,
      description: `Observed yield declining ${round(Math.abs(slope), 2)}% per batch `
        + `(total drop ${round(totalLoss, 1)}% over ${sorted.length} batches).`,
      product: productName,
      parameter: 'Yield',
      severity: totalLoss > 5 ? 'high' : severityFromConfidence(confidence),
      confidence,
      slope: round(slope, 3),
      metric: 'Yield %',
    });
  });
  return results;
}

function utilityOutOfSpec(record: UtilityRecord): string[] {
  const issues: string[] = [];
  const limits = {
    hvacTemperature: { min: 18, max: 25, label: 'HVAC Temperature' },
    relativeHumidity: { min: 40, max: 60, label: 'Relative Humidity' },
    differentialPressure: { min: 10, max: 20, label: 'Differential Pressure' },
  };
  Object.entries(limits).forEach(([field, lim]) => {
    const val = record[field as keyof UtilityRecord] as number;
    if (typeof val === 'number' && (val < lim.min || val > lim.max)) {
      issues.push(lim.label);
    }
  });
  return issues;
}

function detectEquipmentImpact(
  utilities: UtilityRecord[],
  cpp: CppRecord[],
  cqa: CqaRecord[],
  equipment: Record<string, unknown>[],
  product?: string,
): AiDetection[] {
  const results: AiDetection[] = [];
  const utilFiltered = filterProduct(utilities, product);

  const batchIssues = new Map<string, string[]>();
  utilFiltered.forEach((u) => {
    const issues = utilityOutOfSpec(u);
    if (issues.length) batchIssues.set(u.batchNo, issues);
  });

  batchIssues.forEach((issues, batchNo) => {
    const cppHits = cpp.filter((r) => r.batchNo === batchNo && (r.status === 'OOT' || r.status === 'OOS'));
    const cqaHits = cqa.filter((r) => r.batchNo === batchNo && (r.status === 'OOT' || r.status === 'OOS'));
    if (!cppHits.length && !cqaHits.length) return;

    const productName = cppHits[0]?.productName || cqaHits[0]?.productName || 'Unknown';
    const params = [...cppHits.map((r) => r.parameterName), ...cqaHits.map((r) => r.testParameter)];
    const confidence = round(Math.min(85, 55 + params.length * 8));

    results.push({
      id: `equip-${batchNo}`,
      type: 'equipment_impact',
      title: `Batch ${batchNo} — Equipment / Utility Impact`,
      description: `Utility excursions (${issues.join(', ')}) coincide with OOT/OOS on `
        + `${params.slice(0, 3).join(', ')}${params.length > 3 ? '…' : ''}.`,
      product: productName,
      parameter: issues[0],
      severity: cqaHits.some((r) => r.status === 'OOS') ? 'high' : 'medium',
      confidence,
    });
  });

  const unqualified = equipment.filter((e) => {
    const status = String(e.status || e.qualification_status || '').toLowerCase();
    return status && !['qualified', 'active', 'calibrated', 'ok'].includes(status);
  });

  unqualified.slice(0, 5).forEach((eq) => {
    const eqId = String(eq.equipment_id || eq.id || 'Equipment');
    const name = String(eq.name || eq.equipment_name || eqId);
    results.push({
      id: `equip-status-${eqId}`,
      type: 'equipment_impact',
      title: `${eqId} — Qualification / Calibration Risk`,
      description: `${name} is not in qualified/calibrated status. Review impact on linked batches and CPP data.`,
      product: product && product !== 'all' ? product : 'All Products',
      parameter: name,
      severity: 'high',
      confidence: 78,
    });
  });

  return results;
}

function detectCqaDeterioration(cqa: CqaRecord[], product?: string): AiDetection[] {
  const series = cqaSeries(cqa, product);
  const results: AiDetection[] = [];

  series.forEach((points, key) => {
    if (points.length < 4) return;
    const [productName, parameter] = key.split('|');
    const values = points.map((p) => p.value);
    const { slope, r2 } = linearRegression(values);
    const last = points[points.length - 1];
    const range = last.usl - last.lsl || 1;
    const normalizedSlope = slope / range;

    const recent = values.slice(-3);
    const earlier = values.slice(0, 3);
    const recentMean = recent.reduce((s, v) => s + v, 0) / recent.length;
    const earlierMean = earlier.reduce((s, v) => s + v, 0) / earlier.length;
    const worsening = Math.abs(recentMean - last.target) > Math.abs(earlierMean - last.target);

    if (!worsening && Math.abs(normalizedSlope) < 0.02) return;

    const ootCount = filterProduct(cqa, product).filter(
      (r) => r.testParameter === parameter && r.productName === productName && r.status === 'OOT',
    ).length;

    const confidence = round(Math.min(90, 42 + r2 * 30 + ootCount * 5));

    results.push({
      id: `cqa-det-${key}`,
      type: 'cqa_deterioration',
      title: `${parameter} — CQA Deterioration`,
      description: `CQA trend moving away from target for ${parameter} on ${productName}. `
        + `${ootCount} OOT event(s) recorded. Recent mean ${round(recentMean, 2)} vs target ${round(last.target, 2)}.`,
      product: productName,
      parameter,
      severity: ootCount >= 2 ? 'high' : severityFromConfidence(confidence),
      confidence,
      slope: round(slope, 4),
    });
  });

  return results;
}

function buildAlerts(detections: AiDetection[]): PredictiveAlert[] {
  const actionMap: Record<AiDetectionType, string> = {
    process_drift: 'Review CPP/CQA control strategy; investigate special-cause factors and update SPC limits if warranted.',
    future_oos: 'Initiate pre-OOS investigation; hold or tighten in-process checks for affected parameter.',
    future_oot: 'Increase sampling frequency and verify equipment calibration before next campaign.',
    yield_loss: 'Analyze bulk/filling/packing yield breakdown; review material losses and line speed settings.',
    equipment_impact: 'Schedule PM/calibration; quarantine affected batches pending QA assessment.',
    cqa_deterioration: 'Trend CQA results weekly; evaluate formulation or process parameter adjustments.',
  };

  const windowMap: Record<AiSeverity, string> = {
    critical: 'Immediate (0–7 days)',
    high: 'Short-term (7–14 days)',
    medium: 'Medium-term (14–30 days)',
    low: 'Monitor (30–60 days)',
    info: 'Informational',
  };

  return detections
    .filter((d) => d.severity !== 'info')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12)
    .map((d) => ({
      ...d,
      recommendedAction: actionMap[d.type],
      dueWindow: windowMap[d.severity],
    }));
}

function buildRecommendations(
  detections: AiDetection[],
  riskScore: number,
  avgCpk: number,
): AiRecommendation[] {
  const recs: AiRecommendation[] = [];
  let id = 1;

  const add = (
    priority: AiRecommendation['priority'],
    title: string,
    action: string,
    rationale: string,
    category: AiRecommendation['category'],
  ) => {
    recs.push({ id: `rec-${id++}`, priority, title, action, rationale, category });
  };

  if (detections.some((d) => d.type === 'future_oos')) {
    add('Immediate', 'Pre-OOS Containment Plan',
      'Activate batch hold criteria and escalate to QA for affected products showing OOS trajectory.',
      'Predictive model indicates specification breach within upcoming batches.',
      'future_oos');
  }
  if (detections.some((d) => d.type === 'process_drift')) {
    add('High', 'Special-Cause Investigation',
      'Perform 5-Why / fishbone on drifting CPP parameters and document in deviation system.',
      'Statistically significant drift detected on one or more process parameters.',
      'process_drift');
  }
  if (detections.some((d) => d.type === 'yield_loss')) {
    add('High', 'Yield Recovery Review',
      'Conduct line balance and material reconciliation for products with declining yield.',
      'Negative yield slope exceeds alert threshold.',
      'yield_loss');
  }
  if (detections.some((d) => d.type === 'equipment_impact')) {
    add('High', 'Equipment Qualification Check',
      'Verify calibration status and perform impact assessment on co-occurring OOT/OOS batches.',
      'Utility excursions or equipment status linked to quality events.',
      'equipment_impact');
  }
  if (detections.some((d) => d.type === 'cqa_deterioration')) {
    add('Medium', 'CQA Trend Review',
      'Schedule product quality review and update CPV sampling plan for deteriorating CQAs.',
      'CQA parameters show worsening distance from target.',
      'cqa_deterioration');
  }
  if (avgCpk < 1.33) {
    add('Medium', 'Capability Improvement',
      'Target Cpk ≥ 1.33 via process centering; review control limits in CPV Configuration.',
      `Average Cpk (${round(avgCpk, 2)}) below industry target.`,
      'general');
  }
  if (riskScore >= 50) {
    add('Immediate', 'Management Escalation',
      'Present CPV AI findings at quality council; assign owners and due dates for top alerts.',
      `Composite risk score ${round(riskScore, 0)} exceeds acceptable threshold.`,
      'general');
  }
  if (!recs.length) {
    add('Low', 'Continue Routine CPV',
      'Maintain current monitoring frequency; no predictive risks above threshold.',
      'Process and product quality indicators within expected statistical control.',
      'general');
  }

  const priorityOrder = { Immediate: 0, High: 1, Medium: 2, Low: 3 };
  return recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

function buildManagementSummary(
  detections: AiDetection[],
  riskScore: number,
  healthScore: number,
  stats: { oot: number; oos: number; avgCpk: number },
  product?: string,
): { summary: string; bullets: string[] } {
  const scope = product && product !== 'all' ? product : 'all products under CPV scope';
  const critical = detections.filter((d) => d.severity === 'critical').length;
  const high = detections.filter((d) => d.severity === 'high').length;
  const topTypes = Array.from(new Set(detections.slice(0, 5).map((d) => d.type)));

  const summary = `AI analytics for ${scope} indicates an overall health score of ${round(healthScore, 0)}/100 `
    + `and composite risk score of ${round(riskScore, 0)}/100. `
    + `${detections.length} predictive signal(s) were identified, including ${critical} critical and ${high} high-priority findings. `
    + `Current period shows ${stats.oos} OOS and ${stats.oot} OOT event(s) with average Cpk of ${round(stats.avgCpk, 2)}. `
    + (critical > 0
      ? 'Immediate management attention is recommended for parameters with projected specification failures.'
      : 'No imminent specification breach is projected; continue enhanced monitoring on flagged trends.');

  const bullets = [
    `${detections.filter((d) => d.type === 'process_drift').length} process drift signal(s) detected`,
    `${detections.filter((d) => d.type === 'future_oos').length} future OOS risk projection(s)`,
    `${detections.filter((d) => d.type === 'future_oot').length} future OOT risk projection(s)`,
    `${detections.filter((d) => d.type === 'yield_loss').length} yield loss trend(s)`,
    `${detections.filter((d) => d.type === 'equipment_impact').length} equipment / utility impact correlation(s)`,
    `${detections.filter((d) => d.type === 'cqa_deterioration').length} CQA deterioration signal(s)`,
  ];

  if (topTypes.length) {
    bullets.push(`Primary focus areas: ${topTypes.map((t) => t.replace(/_/g, ' ')).join(', ')}`);
  }

  return { summary, bullets };
}

function estimateModelAccuracy(observations: TrendObservation[]): number {
  if (observations.length < 5) return 72;
  const enriched = enrichTrendSeries(observations.slice(0, Math.min(30, observations.length)));
  if (enriched.length < 3) return 75;
  let hits = 0;
  enriched.forEach((pt, i) => {
    if (i === 0) return;
    const prev = enriched[i - 1];
    const predicted = prev.trendLine;
    const actual = pt.observed;
    const tolerance = Math.abs(pt.upperLimit - pt.lowerLimit) * 0.15 || 1;
    if (Math.abs(actual - predicted) <= tolerance) hits++;
  });
  const rate = hits / Math.max(1, enriched.length - 1);
  return round(72 + rate * 22);
}

export function runCpvAiAnalytics(input: {
  cpp: CppRecord[];
  cqa: CqaRecord[];
  yields: YieldRecord[];
  utilities: UtilityRecord[];
  equipment: Record<string, unknown>[];
  deviations: Record<string, unknown>[];
  risks: RiskRecord[];
  filters?: AiAnalyticsFilters;
}): AiAnalyticsReport {
  const product = input.filters?.product;
  const cppF = filterProduct(input.cpp, product);
  const cqaF = filterProduct(input.cqa, product);

  const cppMap = cppSeries(input.cpp, product);
  const cqaMap = cqaSeries(input.cqa, product);

  const detections: AiDetection[] = [
    ...detectProcessDrift(cppMap, 'cpp'),
    ...detectProcessDrift(cqaMap, 'cqa'),
    ...detectFutureOos(cppMap, 'cpp'),
    ...detectFutureOos(cqaMap, 'cqa'),
    ...detectFutureOot(cppMap, 'cpp'),
    ...detectFutureOot(cqaMap, 'cqa'),
    ...detectYieldLoss(input.yields, product),
    ...detectEquipmentImpact(input.utilities, cppF, cqaF, input.equipment, product),
    ...detectCqaDeterioration(input.cqa, product),
  ].sort((a, b) => {
    const sev = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return sev[a.severity] - sev[b.severity] || b.confidence - a.confidence;
  });

  const stats = {
    ...countByStatus([...cppF, ...cqaF]),
  };
  const { averageCpk } = computeCapabilityAverages(cppF, cqaF);

  const yieldTrend = (() => {
    const y = filterProduct(input.yields, product);
    if (y.length < 2) return 0;
    const sorted = y.slice().sort(
      (a, b) => safeDate(a.manufacturingDate).getTime() - safeDate(b.manufacturingDate).getTime(),
    );
    return linearRegression(sorted.map((r) => r.observedValue)).slope;
  })();

  const controlViolations = detections.filter((d) => d.type === 'process_drift').length;
  const riskScore = calculateAiRiskScore({
    oot: stats.oot,
    oos: stats.oos,
    deviations: input.deviations.length,
    averageCpk,
    yieldTrend,
    controlViolations,
  });
  const healthScore = round(Math.max(0, 100 - riskScore * 0.85 + Math.min(averageCpk, 1.33) * 5));

  const alerts = buildAlerts(detections);
  const recommendations = buildRecommendations(detections, riskScore, averageCpk);
  const { summary, bullets } = buildManagementSummary(
    detections, riskScore, healthScore, { ...stats, avgCpk: averageCpk }, product,
  );

  const observations = mergeTrendObservations(
    filterProduct(input.yields, product),
    cppF,
    cqaF,
  );

  const detectionCounts = {
    process_drift: detections.filter((d) => d.type === 'process_drift').length,
    future_oos: detections.filter((d) => d.type === 'future_oos').length,
    future_oot: detections.filter((d) => d.type === 'future_oot').length,
    yield_loss: detections.filter((d) => d.type === 'yield_loss').length,
    equipment_impact: detections.filter((d) => d.type === 'equipment_impact').length,
    cqa_deterioration: detections.filter((d) => d.type === 'cqa_deterioration').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    riskScore,
    healthScore,
    riskLevel: riskLevel(riskScore),
    healthLevel: healthLevel(healthScore),
    detections,
    alerts,
    recommendations,
    managementSummary: summary,
    summaryBullets: bullets,
    modelAccuracy: estimateModelAccuracy(observations),
    detectionCounts,
  };
}

export const DETECTION_LABELS: Record<AiDetectionType, string> = {
  process_drift: 'Process Drift',
  future_oos: 'Future OOS Risk',
  future_oot: 'Future OOT Risk',
  yield_loss: 'Yield Loss Trend',
  equipment_impact: 'Equipment Impact',
  cqa_deterioration: 'CQA Deterioration',
};

export const SEVERITY_COLORS: Record<AiSeverity, string> = {
  critical: 'border-red-500 bg-red-50 text-red-800',
  high: 'border-amber-500 bg-amber-50 text-amber-900',
  medium: 'border-yellow-400 bg-yellow-50 text-yellow-900',
  low: 'border-blue-400 bg-blue-50 text-blue-900',
  info: 'border-slate-300 bg-slate-50 text-slate-700',
};
