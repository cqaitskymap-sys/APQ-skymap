import {
  type TrainerCertification, type TrainerAssessmentChecklist,
  type InductionRecord, type TniRecord, type JobDescription,
  type OjtTrainingPlan, type OjtCompetencyMatrixEntry, type SrdDeclaration,
  type CompanyTrainingDashboard, INTERNAL_TRAINING_TYPES, EVALUATION_METHODS,
  TRAINER_ASSESSMENT_CHECKLIST,
} from './company-training-types';

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const futureDate = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};
const pastDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

export const SEED_TRAINER_CERTIFICATIONS: TrainerCertification[] = [
  {
    id: 'ttc-001', certification_number: 'TTC-2026-0001',
    employee_id: 'emp-101', employee_name: 'Rajesh Kumar', department: 'QA',
    designation: 'Senior Executive', subject_areas: ['GMP', 'SOP Training', 'Data Integrity'],
    assessment_score: 92, passing_score: 80,
    checklist_scores: { subject_knowledge: 18, presentation_skills: 14, training_methodology: 14, gmp_awareness: 14, documentation: 9, assessment_capability: 9, practical_demonstration: 9, trainee_feedback: 5 },
    certified_by: 'qa-001', certified_by_name: 'Dr. Priya Sharma',
    certification_date: pastDate(180), expiry_date: futureDate(18), status: 'Certified',
    certificate_url: null, remarks: 'Certified for GMP and SOP training delivery',
    created_at: pastDate(180), updated_at: pastDate(180), created_by: 'tc-001', created_by_name: 'Training Coordinator',
  },
  {
    id: 'ttc-002', certification_number: 'TTC-2026-0002',
    employee_id: 'emp-102', employee_name: 'Anita Desai', department: 'Production',
    designation: 'Assistant Manager', subject_areas: ['Process Training', 'Equipment Training', 'On-Job Training'],
    assessment_score: 88, passing_score: 80,
    checklist_scores: { subject_knowledge: 17, presentation_skills: 13, training_methodology: 13, gmp_awareness: 13, documentation: 9, assessment_capability: 9, practical_demonstration: 9, trainee_feedback: 5 },
    certified_by: 'qa-001', certified_by_name: 'Dr. Priya Sharma',
    certification_date: pastDate(90), expiry_date: futureDate(6), status: 'Expiring Soon',
    certificate_url: null, remarks: 'Production process trainer — renewal due',
    created_at: pastDate(90), updated_at: pastDate(90), created_by: 'tc-001', created_by_name: 'Training Coordinator',
  },
  {
    id: 'ttc-003', certification_number: 'TTC-2026-0003',
    employee_id: 'emp-103', employee_name: 'Vikram Singh', department: 'QC',
    designation: 'Manager', subject_areas: ['Analytical Methods', 'OOS Investigation', 'GMP'],
    assessment_score: 95, passing_score: 80,
    checklist_scores: { subject_knowledge: 19, presentation_skills: 14, training_methodology: 14, gmp_awareness: 15, documentation: 10, assessment_capability: 10, practical_demonstration: 9, trainee_feedback: 4 },
    certified_by: 'qa-001', certified_by_name: 'Dr. Priya Sharma',
    certification_date: pastDate(30), expiry_date: futureDate(24), status: 'Certified',
    certificate_url: null, remarks: 'QC analytical trainer certified',
    created_at: pastDate(30), updated_at: pastDate(30), created_by: 'tc-001', created_by_name: 'Training Coordinator',
  },
];

export const SEED_INDUCTION_RECORDS: InductionRecord[] = [
  {
    id: 'ind-001', induction_number: 'IND-2026-0001',
    employee_id: 'emp-201', employee_name: 'Suresh Patel', department: 'Production',
    designation: 'Executive', joining_date: pastDate(5),
    current_stage: 'Department Handover', status: 'Pending Dept Head',
    hr_conducted_by: 'hr-001', hr_conducted_by_name: 'Meera Joshi',
    hr_conducted_date: pastDate(3),
    dept_head_id: 'dh-prod', dept_head_name: 'Ramesh Iyer',
    dept_handover_date: null,
    training_coordinator_id: 'tc-001', training_coordinator_name: 'Training Coordinator',
    jd_id: null, jd_number: '', tni_id: null, tni_number: '',
    sop_assignments: [], evaluation_methods: ['Questionnaire', 'Training Attendance Record', 'Training Record'],
    remarks: 'New joinee — HR induction completed, pending dept head handover',
    created_at: pastDate(5), updated_at: pastDate(3), created_by: 'hr-001', created_by_name: 'Meera Joshi',
  },
  {
    id: 'ind-002', induction_number: 'IND-2026-0002',
    employee_id: 'emp-202', employee_name: 'Kavita Nair', department: 'QA',
    designation: 'Officer', joining_date: pastDate(15),
    current_stage: 'TNI Preparation', status: 'TNI In Progress',
    hr_conducted_by: 'hr-001', hr_conducted_by_name: 'Meera Joshi',
    hr_conducted_date: pastDate(12),
    dept_head_id: 'dh-qa', dept_head_name: 'Dr. Priya Sharma',
    dept_handover_date: pastDate(10),
    training_coordinator_id: 'tc-001', training_coordinator_name: 'Training Coordinator',
    jd_id: 'jd-001', jd_number: 'JD-QA-001', tni_id: 'tni-001', tni_number: 'TNI-2026-0001',
    sop_assignments: [], evaluation_methods: ['Questionnaire', 'Training Attendance Record', 'Training Record'],
    remarks: 'JD prepared, TNI in progress',
    created_at: pastDate(15), updated_at: pastDate(8), created_by: 'hr-001', created_by_name: 'Meera Joshi',
  },
  {
    id: 'ind-003', induction_number: 'IND-2026-0003',
    employee_id: 'emp-203', employee_name: 'Amit Verma', department: 'QC',
    designation: 'Senior Officer', joining_date: pastDate(45),
    current_stage: 'Completed', status: 'Completed',
    hr_conducted_by: 'hr-001', hr_conducted_by_name: 'Meera Joshi',
    hr_conducted_date: pastDate(42),
    dept_head_id: 'dh-qc', dept_head_name: 'Vikram Singh',
    dept_handover_date: pastDate(40),
    training_coordinator_id: 'tc-001', training_coordinator_name: 'Training Coordinator',
    jd_id: 'jd-002', jd_number: 'JD-QC-001', tni_id: 'tni-002', tni_number: 'TNI-2026-0002',
    sop_assignments: ['SOP-QC-001', 'SOP-QC-005', 'SOP-GMP-001'],
    evaluation_methods: ['Questionnaire', 'Training Attendance Record', 'Training Record'],
    remarks: 'Induction completed — all SOP trainings assigned',
    created_at: pastDate(45), updated_at: pastDate(20), created_by: 'hr-001', created_by_name: 'Meera Joshi',
  },
];

export const SEED_JOB_DESCRIPTIONS: JobDescription[] = [
  {
    id: 'jd-001', jd_number: 'JD-QA-001', department: 'QA', designation: 'Officer',
    role_title: 'Quality Assurance Officer',
    responsibilities: ['Document review', 'Batch record review', 'Deviation investigation', 'CAPA management'],
    required_competencies: ['GMP knowledge', 'SOP compliance', 'Documentation skills', 'Investigation skills'],
    linked_sops: [
      { sop_number: 'SOP-QA-001', sop_title: 'Document Control Procedure' },
      { sop_number: 'SOP-QA-005', sop_title: 'Deviation Management' },
      { sop_number: 'SOP-GMP-001', sop_title: 'Good Manufacturing Practices' },
    ],
    prepared_by: 'tc-001', prepared_by_name: 'Training Coordinator',
    approved_by: 'dh-qa', status: 'Active', created_at: pastDate(10), updated_at: pastDate(8),
  },
  {
    id: 'jd-002', jd_number: 'JD-QC-001', department: 'QC', designation: 'Senior Officer',
    role_title: 'Quality Control Senior Officer',
    responsibilities: ['Sample analysis', 'Method validation', 'OOS investigation', 'Instrument calibration'],
    required_competencies: ['Analytical techniques', 'HPLC/GC operation', 'OOS handling', 'GMP compliance'],
    linked_sops: [
      { sop_number: 'SOP-QC-001', sop_title: 'HPLC Analysis Procedure' },
      { sop_number: 'SOP-QC-005', sop_title: 'OOS Investigation' },
      { sop_number: 'SOP-GMP-001', sop_title: 'Good Manufacturing Practices' },
    ],
    prepared_by: 'tc-001', prepared_by_name: 'Training Coordinator',
    approved_by: 'dh-qc', status: 'Active', created_at: pastDate(40), updated_at: pastDate(35),
  },
];

export const SEED_TNI_RECORDS: TniRecord[] = [
  {
    id: 'tni-001', tni_number: 'TNI-2026-0001', jd_id: 'jd-001', jd_number: 'JD-QA-001',
    department: 'QA', designation: 'Officer', employee_id: 'emp-202', employee_name: 'Kavita Nair',
    training_needs: [
      { sop_number: 'SOP-QA-001', sop_title: 'Document Control Procedure', training_type: 'Training of New Joinee', priority: 'High', evaluation_methods: ['Questionnaire', 'Training Record'], remarks: '' },
      { sop_number: 'SOP-QA-005', sop_title: 'Deviation Management', training_type: 'Training of New Joinee', priority: 'High', evaluation_methods: ['Questionnaire', 'Training Attendance Record', 'Training Record'], remarks: '' },
      { sop_number: 'SOP-GMP-001', sop_title: 'Good Manufacturing Practices', training_type: 'Induction', priority: 'High', evaluation_methods: ['Questionnaire', 'Training Record'], remarks: 'Mandatory GMP induction' },
    ],
    prepared_by: 'tc-001', prepared_by_name: 'Training Coordinator',
    reviewed_by: null, reviewed_by_name: null,
    status: 'Pending Review', sop_mapped: true, training_assigned: false,
    created_at: pastDate(8), updated_at: pastDate(8),
  },
  {
    id: 'tni-002', tni_number: 'TNI-2026-0002', jd_id: 'jd-002', jd_number: 'JD-QC-001',
    department: 'QC', designation: 'Senior Officer', employee_id: 'emp-203', employee_name: 'Amit Verma',
    training_needs: [
      { sop_number: 'SOP-QC-001', sop_title: 'HPLC Analysis Procedure', training_type: 'Training of New Joinee', priority: 'High', evaluation_methods: ['Questionnaire', 'Training Record'], remarks: '' },
      { sop_number: 'SOP-QC-005', sop_title: 'OOS Investigation', training_type: 'Training of New Joinee', priority: 'Medium', evaluation_methods: ['Questionnaire', 'Training Attendance Record'], remarks: '' },
      { sop_number: 'SOP-GMP-001', sop_title: 'Good Manufacturing Practices', training_type: 'Induction', priority: 'High', evaluation_methods: ['Questionnaire'], remarks: '' },
    ],
    prepared_by: 'tc-001', prepared_by_name: 'Training Coordinator',
    reviewed_by: 'qa-001', reviewed_by_name: 'Dr. Priya Sharma',
    status: 'Training Assigned', sop_mapped: true, training_assigned: true,
    created_at: pastDate(35), updated_at: pastDate(20),
  },
];

export const SEED_OJT_PLANS: OjtTrainingPlan[] = [
  {
    id: 'ojt-001', plan_number: 'OJT-2026-0001',
    employee_id: 'emp-201', employee_name: 'Suresh Patel', department: 'Production',
    designation: 'Executive', mentor_id: 'emp-102', mentor_name: 'Anita Desai',
    training_area: 'Tablet Compression Operation', sop_number: 'SOP-PROD-012',
    sop_title: 'Tablet Compression Machine Operation',
    planned_start: today(), planned_end: futureDate(1),
    actual_start: null, actual_end: null,
    tasks: [
      { task_number: 1, description: 'Machine setup and pre-operation checks', competency_required: 'Basic', status: 'Pending', mentor_sign_off: false, sign_off_date: null },
      { task_number: 2, description: 'In-process checks during compression', competency_required: 'Competent', status: 'Pending', mentor_sign_off: false, sign_off_date: null },
      { task_number: 3, description: 'Cleaning and maintenance procedure', competency_required: 'Competent', status: 'Pending', mentor_sign_off: false, sign_off_date: null },
      { task_number: 4, description: 'Batch documentation and line clearance', competency_required: 'Proficient', status: 'Pending', mentor_sign_off: false, sign_off_date: null },
    ],
    status: 'Planned', mentor_remarks: '', qa_remarks: '',
    created_at: pastDate(2), updated_at: pastDate(2),
  },
  {
    id: 'ojt-002', plan_number: 'OJT-2026-0002',
    employee_id: 'emp-204', employee_name: 'Deepak Rao', department: 'QC',
    designation: 'Officer', mentor_id: 'emp-103', mentor_name: 'Vikram Singh',
    training_area: 'HPLC Analysis', sop_number: 'SOP-QC-001',
    sop_title: 'HPLC Analysis Procedure',
    planned_start: pastDate(20), planned_end: pastDate(5),
    actual_start: pastDate(20), actual_end: pastDate(6),
    tasks: [
      { task_number: 1, description: 'System suitability and column equilibration', competency_required: 'Basic', status: 'Completed', mentor_sign_off: true, sign_off_date: pastDate(15) },
      { task_number: 2, description: 'Sample preparation and injection', competency_required: 'Competent', status: 'Completed', mentor_sign_off: true, sign_off_date: pastDate(10) },
      { task_number: 3, description: 'Chromatogram evaluation and calculation', competency_required: 'Proficient', status: 'Completed', mentor_sign_off: true, sign_off_date: pastDate(6) },
    ],
    status: 'Completed', mentor_remarks: 'Competent in HPLC analysis', qa_remarks: 'Approved',
    created_at: pastDate(25), updated_at: pastDate(6),
  },
];

export const SEED_OJT_MATRIX: OjtCompetencyMatrixEntry[] = [
  { id: 'ojtm-001', department: 'Production', designation: 'Executive', skill_area: 'Tablet Compression', sop_number: 'SOP-PROD-012', competency_level: 'Competent', ojt_required: true, refresher_frequency: 'Yearly', status: 'Active' },
  { id: 'ojtm-002', department: 'Production', designation: 'Executive', skill_area: 'Coating Operation', sop_number: 'SOP-PROD-015', competency_level: 'Competent', ojt_required: true, refresher_frequency: 'Yearly', status: 'Active' },
  { id: 'ojtm-003', department: 'QC', designation: 'Officer', skill_area: 'HPLC Analysis', sop_number: 'SOP-QC-001', competency_level: 'Proficient', ojt_required: true, refresher_frequency: 'Half Yearly', status: 'Active' },
  { id: 'ojtm-004', department: 'QA', designation: 'Officer', skill_area: 'Batch Record Review', sop_number: 'SOP-QA-003', competency_level: 'Competent', ojt_required: true, refresher_frequency: 'Yearly', status: 'Active' },
];

export const SEED_SRD_DECLARATIONS: SrdDeclaration[] = [
  {
    id: 'srd-001', declaration_number: 'SRD-2026-0001',
    employee_id: 'emp-102', employee_name: 'Anita Desai', department: 'Production',
    designation: 'Assistant Manager', document_number: 'SOP-PROD-020',
    document_title: 'Changeover Procedure', document_version: '3.0', sop_number: 'SOP-PROD-020',
    reading_date: pastDate(2),
    declaration_text: 'I have read and understood the above SOP in its entirety and agree to comply with its requirements.',
    employee_signature: 'Anita Desai', employee_signed_date: pastDate(2),
    qa_reviewer_id: 'qa-001', qa_reviewer_name: 'Dr. Priya Sharma', qa_review_date: pastDate(1),
    status: 'Approved', remarks: '', created_at: pastDate(3), updated_at: pastDate(1),
  },
  {
    id: 'srd-002', declaration_number: 'SRD-2026-0002',
    employee_id: 'emp-103', employee_name: 'Vikram Singh', department: 'QC',
    designation: 'Manager', document_number: 'SOP-QC-010',
    document_title: 'Stability Study Protocol', document_version: '2.1', sop_number: 'SOP-QC-010',
    reading_date: today(),
    declaration_text: 'I have read and understood the above SOP in its entirety and agree to comply with its requirements.',
    employee_signature: null, employee_signed_date: null,
    qa_reviewer_id: null, qa_reviewer_name: null, qa_review_date: null,
    status: 'Pending Declaration', remarks: 'Awaiting manager self-reading declaration',
    created_at: pastDate(1), updated_at: pastDate(1),
  },
];

export function computeCompanyTrainingDashboard(
  trainers: TrainerCertification[],
  inductions: InductionRecord[],
  tnis: TniRecord[],
  ojtPlans: OjtTrainingPlan[],
  srds: SrdDeclaration[],
): CompanyTrainingDashboard {
  const internalBreakdown = INTERNAL_TRAINING_TYPES.map((type) => {
    let count = 0;
    if (type === 'Induction') count = inductions.length;
    else if (type === 'Training of New Joinee') count = inductions.filter((i) => i.status !== 'Completed').length;
    else if (type === 'On-Job Training') count = ojtPlans.length;
    else if (type === 'Self Reading Declaration') count = srds.length;
    else if (type === 'Refresher Training') count = tnis.filter((t) => t.training_needs.some((n) => n.training_type === 'Refresher Training')).length;
    else if (type === 'Need Based Training') count = tnis.filter((t) => t.training_needs.some((n) => n.training_type === 'Need Based Training')).length;
    return { type, count };
  });

  const evalUsage = EVALUATION_METHODS.map((method) => {
    const count = [...inductions, ...tnis].reduce((acc, rec) => {
      const methods = 'evaluation_methods' in rec ? rec.evaluation_methods
        : rec.training_needs?.flatMap((n) => n.evaluation_methods) || [];
      return acc + (methods.includes(method) ? 1 : 0);
    }, 0);
    return { method, count };
  });

  return {
    totalCertifiedTrainers: trainers.filter((t) => t.status === 'Certified' || t.status === 'Expiring Soon').length,
    trainerCertExpiring: trainers.filter((t) => t.status === 'Expiring Soon').length,
    activeInductions: inductions.filter((i) => i.status !== 'Completed' && i.status !== 'Cancelled').length,
    pendingDeptHandover: inductions.filter((i) => i.status === 'Pending Dept Head').length,
    activeTniRecords: tnis.filter((t) => t.status !== 'Closed').length,
    sopMappedTni: tnis.filter((t) => t.sop_mapped).length,
    activeOjtPlans: ojtPlans.filter((p) => !['Completed', 'Cancelled'].includes(p.status)).length,
    ojtCompleted: ojtPlans.filter((p) => p.status === 'Completed').length,
    pendingSrdDeclarations: srds.filter((s) => ['Draft', 'Pending Declaration'].includes(s.status)).length,
    srdApproved: srds.filter((s) => s.status === 'Approved').length,
    internalTrainingBreakdown: internalBreakdown,
    evaluationMethodUsage: evalUsage,
    inductionRecords: inductions,
    certifiedTrainers: trainers,
    tniRecords: tnis,
    ojtPlans: ojtPlans,
    srdDeclarations: srds,
  };
}

export function computeTrainerAssessmentScore(
  scores: Record<string, number>,
): { total: number; max: number; percent: number; result: 'Pass' | 'Fail' } {
  let total = 0;
  let max = 0;
  for (const item of TRAINER_ASSESSMENT_CHECKLIST) {
    total += scores[item.id] ?? 0;
    max += item.weight;
  }
  const percent = max > 0 ? Math.round((total / max) * 100) : 0;
  return { total, max, percent, result: percent >= 80 ? 'Pass' : 'Fail' };
}

export { TRAINER_ASSESSMENT_CHECKLIST };
