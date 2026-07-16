/** LMS workflow definitions — CO-LMS-URS-001-00 + process flow diagrams */

export interface WorkflowStep {
  id: string;
  label: string;
  actor?: string;
  decision?: boolean;
  optional?: boolean;
  dashed?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  title: string;
  description: string;
  steps: WorkflowStep[];
}

// ─── Setup workflows ───────────────────────────────────────────────

export const TRAINING_CONTENT_WORKFLOW: WorkflowDefinition = {
  id: 'training-content',
  title: 'Training Content',
  description: 'Create content types → create content → submit for approval → approve/revert → revision/withdrawal',
  steps: [
    { id: '1', label: 'Create Training Group', actor: 'Training Coordinator' },
    { id: '2', label: 'Create Content Type', actor: 'Training Coordinator' },
    { id: '3', label: 'Create Training Content', actor: 'Training Coordinator' },
    { id: '4', label: 'Setup Questionnaire', actor: 'Training Coordinator' },
    { id: '5', label: 'Setup Training Documents', actor: 'Training Coordinator' },
    { id: '6', label: 'Assign Trainer', actor: 'Training Coordinator' },
    { id: '7', label: 'Submit for Approval', actor: 'Training Coordinator' },
    { id: '8', label: 'Approver Decision', actor: 'Approver', decision: true },
    { id: '9', label: 'Content Approved', actor: 'System' },
  ],
};

export const TRAINING_MATRIX_WORKFLOW: WorkflowDefinition = {
  id: 'training-matrix',
  title: 'Training Matrix / Template',
  description: 'BU, Department, Induction, JR matrix — create, edit, approve, version control',
  steps: [
    { id: '1', label: 'Create Matrix/Template', actor: 'Training Coordinator' },
    { id: '2', label: 'Edit Matrix', actor: 'Training Coordinator' },
    { id: '3', label: 'Submit for Approval', actor: 'Training Coordinator' },
    { id: '4', label: 'Approver Decision', actor: 'Approver', decision: true },
    { id: '5', label: 'Unique ID Generated', actor: 'System' },
    { id: '6', label: 'Matrix Active (Versioned)', actor: 'System' },
  ],
};

// ─── Program workflows (from diagrams) ─────────────────────────────

export const INDUCTION_WORKFLOW: WorkflowDefinition = {
  id: 'induction',
  title: 'Induction Training',
  description: 'Create induction group → approval → schedule → conduct → attendance → trainer acknowledgment',
  steps: [
    { id: '1', label: 'Create Induction Group', actor: 'Training Coordinator' },
    { id: '2', label: 'Send for Approval', actor: 'Training Coordinator' },
    { id: '3', label: 'Approver Decision', actor: 'Approver', decision: true },
    { id: '4', label: 'Schedule Session', actor: 'Training Coordinator' },
    { id: '5', label: 'Conduct / Reschedule Session', actor: 'Training Coordinator' },
    { id: '6', label: 'Mark Attendance', actor: 'Training Coordinator' },
    { id: '7', label: 'Trainer Acknowledgment', actor: 'Trainer' },
    { id: '8', label: 'Induction Completed', actor: 'System' },
  ],
};

export const JR_ASSIGNMENT_WORKFLOW: WorkflowDefinition = {
  id: 'jr-assignment',
  title: 'JR Assignment',
  description: 'Assign Job Role to trainee — coordinator → approver → employee acceptance',
  steps: [
    { id: '1', label: 'Training Coordinator Review', actor: 'Training Coordinator' },
    { id: '2', label: 'Select Employee', actor: 'Training Coordinator' },
    { id: '3', label: 'Select JR from Template', actor: 'Training Coordinator' },
    { id: '4', label: 'Is JR Training Required?', actor: 'Training Coordinator', decision: true },
    { id: '5', label: 'Select Approver', actor: 'Training Coordinator' },
    { id: '6', label: 'Send for Approval', actor: 'Training Coordinator' },
    { id: '7', label: 'Approver Decision', actor: 'Approver', decision: true },
    { id: '8', label: 'JR Sent to Employee', actor: 'System' },
    { id: '9', label: 'Employee Accept / Revert', actor: 'Trainee', decision: true },
    { id: '10', label: 'JR Assigned', actor: 'System' },
    { id: '11', label: 'Biometric Accept (Classroom Only)', actor: 'Training Coordinator', dashed: true, optional: true },
  ],
};

export const JR_TRAINING_SCHEDULE_WORKFLOW: WorkflowDefinition = {
  id: 'jr-training-schedule',
  title: 'JR Training Schedule',
  description: 'When JR training is required — assign functional role training to accepted JR employees',
  steps: [
    { id: '1', label: 'Is JR Training Required?', actor: 'System', decision: true },
    { id: '2', label: 'Select Employee (Accepted JR)', actor: 'Training Coordinator' },
    { id: '3', label: 'Select Functional Role(s)', actor: 'Training Coordinator' },
    { id: '4', label: 'Add Due Date', actor: 'Training Coordinator' },
    { id: '5', label: 'Modify Mode & Mandatory/Non-Mandatory', actor: 'Training Coordinator' },
    { id: '6', label: 'Is Approval Required?', actor: 'System', decision: true },
    { id: '7', label: 'Select Approver', actor: 'Training Coordinator', optional: true },
    { id: '8', label: 'Approver Decision', actor: 'Approver', decision: true, optional: true },
    { id: '9', label: 'Trainings Assigned', actor: 'System' },
  ],
};

export const JR_TRAINING_EXECUTION_WORKFLOW: WorkflowDefinition = {
  id: 'jr-training-execution',
  title: 'JR Training Execution',
  description: 'Online or classroom path → assessment → completion report',
  steps: [
    { id: '1', label: 'Approved / Trainings Assigned', actor: 'System' },
    { id: '2', label: 'Online Training Assigned', actor: 'System' },
    { id: '3', label: 'Classroom Session Scheduled', actor: 'Training Coordinator' },
    { id: '4', label: 'Session Conduction & Attendance', actor: 'Trainer' },
    { id: '5', label: 'Assessment Type', actor: 'System', decision: true },
    { id: '6', label: 'Oral / Practical — Trainer Assessment', actor: 'Trainer' },
    { id: '7', label: 'Written — Online Assessment', actor: 'Trainee' },
    { id: '8', label: 'Fail (Locked) → Trainer Unlock', actor: 'Trainer', optional: true },
    { id: '9', label: 'Report Generation', actor: 'Training Coordinator' },
    { id: '10', label: 'JR Training Completed', actor: 'System' },
  ],
};

export const MULTI_TARGET_TRAINING_WORKFLOW: WorkflowDefinition = {
  id: 'multi-target-training',
  title: 'Multi Target Training',
  description: 'Coordinator creates multi-document target training with approval',
  steps: [
    { id: '1', label: 'Training Coordinator Creates', actor: 'Training Coordinator' },
    { id: '2', label: 'Select Target Type', actor: 'Training Coordinator' },
    { id: '3', label: 'Add Session (Multi-Doc = Yes)', actor: 'Training Coordinator' },
    { id: '4', label: 'Add Document', actor: 'Training Coordinator' },
    { id: '5', label: 'Schedule Session', actor: 'Training Coordinator' },
    { id: '6', label: 'Select Trainees', actor: 'Training Coordinator' },
    { id: '7', label: 'Approval Required?', actor: 'System', decision: true },
    { id: '8', label: 'Select Approver & Send', actor: 'Training Coordinator', optional: true },
    { id: '9', label: 'Approver Decision', actor: 'Approver', decision: true, optional: true },
    { id: '10', label: 'Submit', actor: 'Training Coordinator' },
    { id: '11', label: 'Online / Classroom Training', actor: 'Trainee' },
    { id: '12', label: 'Training Complete', actor: 'System' },
  ],
};

export const TARGET_TRAINING_WORKFLOW: WorkflowDefinition = {
  id: 'target-training',
  title: 'Target Training',
  description: 'Document training — general, remedial, cGMP, refresher, retraining, revision',
  steps: [
    { id: '1', label: 'Select Target Type', actor: 'Training Coordinator' },
    { id: '2', label: 'Select Document(s)', actor: 'Training Coordinator' },
    { id: '3', label: 'Schedule Session (Online/Classroom)', actor: 'Training Coordinator' },
    { id: '4', label: 'Select Trainees', actor: 'Training Coordinator' },
    { id: '5', label: 'Submit Attendance', actor: 'Training Coordinator' },
    { id: '6', label: 'Trainee Completes Training & Assessment', actor: 'Trainee' },
    { id: '7', label: 'Trainer Evaluation', actor: 'Trainer' },
    { id: '8', label: 'Target Training Complete', actor: 'System' },
  ],
};

export const TARGET_TRAINING_REASSIGN_WORKFLOW: WorkflowDefinition = {
  id: 'target-reassign',
  title: 'Training Reassignment',
  description: 'Trainee selects trained document → comments → optional approver → reassigned',
  steps: [
    { id: '1', label: 'Trainee Selects Trained Document', actor: 'Trainee' },
    { id: '2', label: 'Add Comments & Send for Approval', actor: 'Trainee' },
    { id: '3', label: 'Approver (Optional)', actor: 'Approver', optional: true },
    { id: '4', label: 'Training Reassigned', actor: 'System' },
  ],
};

export const UNSATISFACTORY_WORKFLOW: WorkflowDefinition = {
  id: 'unsatisfactory',
  title: 'Unsatisfactory / Remedial',
  description: 'Trainer marks unsatisfactory → coordinator creates remedial schedule',
  steps: [
    { id: '1', label: 'Trainer Marks Un-Satisfactory', actor: 'Trainer' },
    { id: '2', label: 'Training Coordinator Review', actor: 'Training Coordinator' },
    { id: '3', label: 'Unsatisfactory Employee List', actor: 'System' },
    { id: '4', label: 'Create Schedule', actor: 'Training Coordinator' },
  ],
};

export const WAIVE_TRAINEE_WORKFLOW: WorkflowDefinition = {
  id: 'waive-trainee',
  title: 'Waive Off / Remove Trainee',
  description: 'Remove trainee from target training with justification',
  steps: [
    { id: '1', label: 'Select Target Training', actor: 'Training Coordinator' },
    { id: '2', label: 'Waive Off / Remove with Comments', actor: 'Training Coordinator' },
    { id: '3', label: 'Trainee Removed', actor: 'System' },
  ],
};

export const TARGET_TRAINING_CLOSE_WORKFLOW: WorkflowDefinition = {
  id: 'target-close',
  title: 'Close Target Training',
  description: 'Coordinator requests to close target training — approver approve/reject',
  steps: [
    { id: '1', label: 'Raise Request', actor: 'Training Coordinator' },
    { id: '2', label: 'Approver Decision', actor: 'Approver', decision: true },
    { id: '3a', label: 'Target Training Closed', actor: 'System' },
    { id: '3b', label: 'Target Training Continues', actor: 'System' },
  ],
};

export const OJT_WORKFLOW: WorkflowDefinition = {
  id: 'ojt',
  title: 'On Job Training',
  description: 'Coordinator creates OJT record with trainees, details, attachments',
  steps: [
    { id: '1', label: 'Select Trainees', actor: 'Training Coordinator' },
    { id: '2', label: 'Add Session Details', actor: 'Training Coordinator' },
    { id: '3', label: 'Add Attachments (if required)', actor: 'Training Coordinator' },
    { id: '4', label: 'On Job Training Created', actor: 'System' },
  ],
};

export const OTHER_TRAINING_WORKFLOW: WorkflowDefinition = {
  id: 'other-training',
  title: 'Other Training Record',
  description: 'Manual training record — general, remedial, cGMP types',
  steps: [
    { id: '1', label: 'Add Training Name', actor: 'Training Coordinator' },
    { id: '2', label: 'Add Session Details', actor: 'Training Coordinator' },
    { id: '3', label: 'Add Attachments (if required)', actor: 'Training Coordinator' },
    { id: '4', label: 'Other Training Record Created', actor: 'System' },
  ],
};

export const EXTERNAL_TRAINING_WORKFLOW: WorkflowDefinition = {
  id: 'external-training',
  title: 'External Training',
  description: 'Trainee uploads external records → coordinator approve/reject',
  steps: [
    { id: '1', label: 'Upload External Training Records', actor: 'Trainee' },
    { id: '2', label: 'Training Coordinator Review', actor: 'Training Coordinator' },
    { id: '3', label: 'Approve / Reject', actor: 'Training Coordinator', decision: true },
    { id: '4a', label: 'Record Added in Application', actor: 'System' },
    { id: '4b', label: 'No Record Added', actor: 'System' },
  ],
};

export const ATC_BU_WORKFLOW: WorkflowDefinition = {
  id: 'atc-bu',
  title: 'Annual Training Calendar — Business Unit',
  description: 'HR creates BU calendar → Approver 1 → QA Approver → Calendar Created',
  steps: [
    { id: '1', label: 'HR Creates', actor: 'HR' },
    { id: '2', label: 'Select Documents & Months', actor: 'HR' },
    { id: '3', label: 'Approver 1 Decision', actor: 'Approver', decision: true },
    { id: '4', label: 'QA Approver Decision', actor: 'QA Approver', decision: true },
    { id: '5', label: 'Calendar Created', actor: 'System' },
  ],
};

export const ATC_DEPT_WORKFLOW: WorkflowDefinition = {
  id: 'atc-dept',
  title: 'Annual Training Calendar — Department',
  description: 'Coordinator creates dept calendar → Approver → Calendar Created',
  steps: [
    { id: '1', label: 'Coordinator Creates', actor: 'Training Coordinator' },
    { id: '2', label: 'Select Documents & Months', actor: 'Training Coordinator' },
    { id: '3', label: 'Approver Decision', actor: 'Approver', decision: true },
    { id: '4', label: 'Calendar Created', actor: 'System' },
  ],
};

export const TRAINING_SESSION_WORKFLOW: WorkflowDefinition = {
  id: 'training-session',
  title: 'Training Session',
  description: 'Coordinator creates → HOD approves → session conduction → trainee assessment → trainer evaluation',
  steps: [
    { id: '1', label: 'Training Coordinator Creates', actor: 'Training Coordinator' },
    { id: '2', label: 'Approver (HOD) Decision', actor: 'Approver', decision: true },
    { id: '3', label: 'Create Classroom/Online Session', actor: 'Trainer / Coordinator' },
    { id: '4', label: 'Take Attendance', actor: 'Trainer / Coordinator' },
    { id: '5', label: 'Trainee Reads Document & Takes Exam', actor: 'Trainee' },
    { id: '6', label: 'Trainer Evaluates (Oral/Practical/Offline)', actor: 'Trainer' },
  ],
};

export const TRAINER_ACTIONS_WORKFLOW: WorkflowDefinition = {
  id: 'trainer-actions',
  title: 'Trainer Actions',
  description: 'Trainer unlock, Q&A, suggestion approval',
  steps: [
    { id: '1', label: 'Unlock Locked Trainee', actor: 'Trainer' },
    { id: '2', label: 'Answer Trainee Questions', actor: 'Trainer' },
    { id: '3', label: 'Approve / Reject Trainee Suggestion', actor: 'Trainer' },
  ],
};

export const ALL_WORKFLOWS: WorkflowDefinition[] = [
  TRAINING_CONTENT_WORKFLOW,
  TRAINING_MATRIX_WORKFLOW,
  INDUCTION_WORKFLOW,
  JR_ASSIGNMENT_WORKFLOW,
  JR_TRAINING_SCHEDULE_WORKFLOW,
  JR_TRAINING_EXECUTION_WORKFLOW,
  MULTI_TARGET_TRAINING_WORKFLOW,
  TARGET_TRAINING_WORKFLOW,
  OJT_WORKFLOW,
  OTHER_TRAINING_WORKFLOW,
  EXTERNAL_TRAINING_WORKFLOW,
  ATC_BU_WORKFLOW,
  ATC_DEPT_WORKFLOW,
  TRAINING_SESSION_WORKFLOW,
  TRAINER_ACTIONS_WORKFLOW,
];

export function getWorkflowById(id: string): WorkflowDefinition | undefined {
  return ALL_WORKFLOWS.find((w) => w.id === id);
}

/** @deprecated use INDUCTION_WORKFLOW from workflows.ts */
export const INDUCTION_WORKFLOW_STEPS = INDUCTION_WORKFLOW.steps.map((s) => s.label) as readonly string[];

/** @deprecated use JR_ASSIGNMENT_WORKFLOW from workflows.ts */
export const JR_ASSIGNMENT_WORKFLOW_STEPS = JR_ASSIGNMENT_WORKFLOW.steps.map((s) => s.label) as readonly string[];

export const TARGET_TRAINING_TYPES = [
  'General', 'Remedial', 'cGMP', 'Refresher', 'Retraining', 'Revision',
  'Document Reading Only', 'Direct Assessment Only',
] as const;

export const LMS_USER_ROLES = [
  'Admin', 'HR', 'HR Approval', 'Trainer', 'Trainee', 'Training Coordinator', 'Approver',
] as const;

export const AUTOMATION_RULES = [
  { id: 'auto-bu-dept', label: 'Auto-assign BU/dept training on JD acceptance', enabled: true },
  { id: 'auto-revised-sop', label: 'Auto-assign revised document training', enabled: true },
  { id: 'auto-refresher', label: 'Auto-assign refresher by functional role', enabled: true },
  { id: 'auto-induction', label: 'Auto-create induction for new employee', enabled: true },
  { id: 'auto-notify-emp', label: 'Email notification to trainee', enabled: true },
  { id: 'auto-notify-overdue', label: 'Overdue training email alerts', enabled: true },
  { id: 'auto-notify-reminder', label: 'Pending training reminder emails', enabled: true },
  { id: 'auto-outlook-block', label: 'Block Outlook calendar for assigned training', enabled: false },
] as const;

export const QMS_INTEGRATIONS = [
  'Employee Master', 'Department', 'Designation', 'Functional Role', 'Document Management', 'HRMS',
] as const;
