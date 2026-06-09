// Mock data for the Pharma QMS platform demonstration

export const mockKPIs = {
  totalBatches: 284,
  batchesMTD: 24,
  releaseRate: 97.2,
  avgYield: 98.4,
  openDeviations: 12,
  openOos: 5,
  openCapa: 18,
  openComplaints: 7,
  stabilityOngoing: 23,
  auditReadinessScore: 94,
  complianceScore: 96.8,
  aiRiskScore: 2.3,
};

export const mockBatchTrend = [
  { month: 'Jan', released: 22, rejected: 1, inProcess: 3 },
  { month: 'Feb', released: 20, rejected: 0, inProcess: 4 },
  { month: 'Mar', released: 25, rejected: 2, inProcess: 2 },
  { month: 'Apr', released: 23, rejected: 1, inProcess: 5 },
  { month: 'May', released: 26, rejected: 0, inProcess: 3 },
  { month: 'Jun', released: 21, rejected: 1, inProcess: 4 },
  { month: 'Jul', released: 24, rejected: 0, inProcess: 6 },
  { month: 'Aug', released: 27, rejected: 1, inProcess: 2 },
  { month: 'Sep', released: 22, rejected: 2, inProcess: 4 },
  { month: 'Oct', released: 25, rejected: 0, inProcess: 5 },
  { month: 'Nov', released: 23, rejected: 1, inProcess: 3 },
  { month: 'Dec', released: 24, rejected: 1, inProcess: 4 },
];

export const mockYieldTrend = [
  { month: 'Jan', yield: 97.8 },
  { month: 'Feb', yield: 98.2 },
  { month: 'Mar', yield: 97.5 },
  { month: 'Apr', yield: 98.6 },
  { month: 'May', yield: 99.1 },
  { month: 'Jun', yield: 98.4 },
  { month: 'Jul', yield: 97.9 },
  { month: 'Aug', yield: 98.7 },
  { month: 'Sep', yield: 99.0 },
  { month: 'Oct', yield: 98.3 },
  { month: 'Nov', yield: 97.6 },
  { month: 'Dec', yield: 98.8 },
];

export const mockOosTrend = [
  { month: 'Jan', count: 3 },
  { month: 'Feb', count: 2 },
  { month: 'Mar', count: 5 },
  { month: 'Apr', count: 2 },
  { month: 'May', count: 1 },
  { month: 'Jun', count: 4 },
  { month: 'Jul', count: 3 },
  { month: 'Aug', count: 2 },
  { month: 'Sep', count: 1 },
  { month: 'Oct', count: 3 },
  { month: 'Nov', count: 2 },
  { month: 'Dec', count: 2 },
];

export const mockDeviationsByType = [
  { name: 'Minor', value: 45, color: '#3B82F6' },
  { name: 'Major', value: 18, color: '#F59E0B' },
  { name: 'Critical', value: 4, color: '#EF4444' },
];

export const mockCapaStatus = [
  { name: 'Open', value: 8, color: '#3B82F6' },
  { name: 'In Progress', value: 6, color: '#F59E0B' },
  { name: 'Verification', value: 4, color: '#8B5CF6' },
  { name: 'Closed', value: 32, color: '#10B981' },
];

export const mockComplianceScore = [
  { module: 'Batch Mfg', score: 98 },
  { module: 'QC Testing', score: 97 },
  { module: 'Deviation Mgmt', score: 95 },
  { module: 'CAPA', score: 93 },
  { module: 'Stability', score: 96 },
  { module: 'Change Control', score: 94 },
  { module: 'Training', score: 99 },
  { module: 'Vendors', score: 91 },
];

export const mockRecentBatches = [
  { id: '1', batch_number: 'BTH-2024-001', product_name: 'Amikacin Sulfate Injection', product_code: 'AMK-100', manufacturing_date: '2024-01-15', status: 'released', yield_percentage: 98.5 },
  { id: '2', batch_number: 'BTH-2024-002', product_name: 'Meropenem Injection', product_code: 'MRP-500', manufacturing_date: '2024-01-18', status: 'released', yield_percentage: 97.9 },
  { id: '3', batch_number: 'BTH-2024-003', product_name: 'Vancomycin HCl Injection', product_code: 'VNC-500', manufacturing_date: '2024-01-20', status: 'in_process', yield_percentage: null },
  { id: '4', batch_number: 'BTH-2024-004', product_name: 'Ceftriaxone Injection', product_code: 'CFT-1G', manufacturing_date: '2024-01-22', status: 'quarantine', yield_percentage: 96.2 },
  { id: '5', batch_number: 'BTH-2024-005', product_name: 'Piperacillin-Tazobactam', product_code: 'PIP-4.5G', manufacturing_date: '2024-01-24', status: 'released', yield_percentage: 99.1 },
];

export const mockRecentDeviations = [
  { id: '1', deviation_number: 'DEV-2024-001', title: 'Temperature excursion in cold room', deviation_type: 'major', status: 'under_investigation', detected_date: '2024-01-20' },
  { id: '2', deviation_number: 'DEV-2024-002', title: 'Particulate matter found in inspection', deviation_type: 'critical', status: 'capa_raised', detected_date: '2024-01-21' },
  { id: '3', deviation_number: 'DEV-2024-003', title: 'Label misalignment on product BTH-2024-002', deviation_type: 'minor', status: 'closed', detected_date: '2024-01-22' },
  { id: '4', deviation_number: 'DEV-2024-004', title: 'pH out of range during formulation', deviation_type: 'major', status: 'open', detected_date: '2024-01-23' },
];

export const mockAiInsights = [
  { id: '1', type: 'warning', title: 'Yield Anomaly Detected', description: 'Batch BTH-2024-006 shows 2.4σ deviation from historical yield mean. Investigate mixing parameters.', confidence: 87, module: 'AI Analytics' },
  { id: '2', type: 'info', title: 'OOS Prediction', description: 'Based on trend analysis, Assay test for AMK-100 shows 73% probability of OOS in next 3 batches.', confidence: 73, module: 'AI Analytics' },
  { id: '3', type: 'success', title: 'CAPA Effectiveness Confirmed', description: 'CAPA-2023-045 shows 95% effectiveness based on last 8 batch outcomes.', confidence: 95, module: 'AI Analytics' },
  { id: '4', type: 'warning', title: 'Equipment Drift Detected', description: 'Filling machine FIL-003 shows progressive calibration drift. PM recommended before next batch.', confidence: 81, module: 'AI Analytics' },
];

export const mockProducts = [
  { id: '1', product_code: 'AMK-100', product_name: 'Amikacin Sulfate Injection', formulation: 'Injection', strength: '100mg/2mL', is_active: true },
  { id: '2', product_code: 'MRP-500', product_name: 'Meropenem Injection', formulation: 'Injection', strength: '500mg/vial', is_active: true },
  { id: '3', product_code: 'VNC-500', product_name: 'Vancomycin HCl Injection', formulation: 'Injection', strength: '500mg/vial', is_active: true },
  { id: '4', product_code: 'CFT-1G', product_name: 'Ceftriaxone Injection', formulation: 'Injection', strength: '1g/vial', is_active: true },
  { id: '5', product_code: 'PIP-4.5G', product_name: 'Piperacillin-Tazobactam', formulation: 'Injection', strength: '4.5g/vial', is_active: true },
  { id: '6', product_code: 'AMX-1G', product_name: 'Amoxicillin Injection', formulation: 'Injection', strength: '1g/vial', is_active: true },
];
