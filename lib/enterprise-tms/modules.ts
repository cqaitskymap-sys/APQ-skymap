import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, CalendarDays, Calendar, Grid3X3, Send, Clock, Users,
  UserCheck, HelpCircle, PenTool, FileText, BookOpen, AlertTriangle, Wrench,
  Globe, History, Settings, Building2,
  FileCheck, BriefcaseBusiness, ListTodo, Layers3, ClipboardCheck, ShieldCheck,
} from 'lucide-react';

export type TmsModuleGroup =
  | 'Overview'
  | 'Master Setup'
  | 'Planning & Assignment'
  | 'Training Execution'
  | 'Records & Compliance';

export interface TmsModuleDefinition {
  id: string;
  name: string;
  description: string;
  href: string;
  group: TmsModuleGroup;
  icon: LucideIcon;
  matchPaths?: string[];
  compliance?: string[];
}

/** URS CO-LMS-URS-001-00 aligned modules. */
export const ENTERPRISE_TMS_MODULES: TmsModuleDefinition[] = [
  { id: 'dashboard', name: 'Dashboard', description: 'Training status, overdue items and approvals', href: '/training', group: 'Overview', icon: LayoutDashboard, matchPaths: ['/training', '/training/dashboard'] },
  { id: 'approvals', name: 'Approval Inbox', description: 'Approve or revert controlled training records', href: '/training/approval-workflow', group: 'Overview', icon: ClipboardCheck, matchPaths: ['/training/approval-workflow', '/training/approvals', '/training/workflows'] },
  { id: 'calendar', name: 'Training Calendar', description: 'Approved training calendar and sessions', href: '/training/calendar', group: 'Overview', icon: CalendarDays, matchPaths: ['/training/calendar', '/training/scheduler', '/training/events'] },

  { id: 'content', name: 'Content & Documents', description: 'Controlled document and training template setup', href: '/training/training-matrix', group: 'Master Setup', icon: BookOpen },
  { id: 'trainer', name: 'Trainer Setup', description: 'Internal and external trainer setup', href: '/training/train-the-trainer', group: 'Master Setup', icon: UserCheck },
  { id: 'questionnaire', name: 'Questionnaires', description: 'Create and revise document questionnaires', href: '/training/questionnaire', group: 'Master Setup', icon: HelpCircle },
  { id: 'matrix', name: 'Training Templates', description: 'Versioned BU, department, induction and JR templates', href: '/training/matrix', group: 'Master Setup', icon: Grid3X3, matchPaths: ['/training/matrix', '/training/training-matrix'] },
  { id: 'settings', name: 'Training Settings', description: 'Training rules, limits and notifications', href: '/training/settings', group: 'Master Setup', icon: Settings },

  { id: 'annual-plan', name: 'Annual Training Calendar', description: 'Department and BU annual training plans', href: '/training/annual-plan', group: 'Planning & Assignment', icon: Calendar },
  { id: 'induction', name: 'Induction Training', description: 'Employee group, batch, sessions and approval', href: '/training/induction', group: 'Planning & Assignment', icon: Building2 },
  { id: 'job-description', name: 'Job Description & TNI', description: 'Assign JD and identify required training', href: '/training/tni', group: 'Planning & Assignment', icon: BriefcaseBusiness },
  { id: 'jr-assignment', name: 'Job Role & TNI', description: 'Assign job roles and identify required training', href: '/training/tni', group: 'Planning & Assignment', icon: ListTodo },
  { id: 'jr-schedule', name: 'JR Training Schedule', description: 'Role-based training schedule and approval', href: '/training/jr-training-schedule', group: 'Planning & Assignment', icon: Clock, matchPaths: ['/training/jr-training-schedule', '/training/scheduling'] },
  { id: 'target', name: 'Target Training', description: 'General, remedial, refresher and revision training', href: '/training/need-based', group: 'Planning & Assignment', icon: AlertTriangle },
  { id: 'multi-target', name: 'Multi-Document Assignment', description: 'Assign multiple documents in one action', href: '/training/assignments', group: 'Planning & Assignment', icon: Layers3 },
  { id: 'training-request', name: 'Training Request', description: 'Request need-based training with approval', href: '/training/training-request', group: 'Planning & Assignment', icon: Send },

  { id: 'schedule', name: 'Schedule & Assignments', description: 'Online and classroom training assignment', href: '/training/scheduling', group: 'Training Execution', icon: Clock, matchPaths: ['/training/scheduling', '/training/schedule', '/training/assignments'] },
  { id: 'session', name: 'Sessions & Attendance', description: 'Conduct, reschedule and record attendance', href: '/training/sessions', group: 'Training Execution', icon: Users, matchPaths: ['/training/sessions', '/training/attendance', '/training/completion'] },
  { id: 'self-training', name: 'Self Training', description: 'Document reading and online assessment', href: '/training/srd', group: 'Training Execution', icon: FileCheck },
  { id: 'assessment', name: 'Assessments', description: 'Written, oral, practical and offline evaluation', href: '/training/assessment', group: 'Training Execution', icon: PenTool, matchPaths: ['/training/assessment', '/training/practical-assessment', '/training/effectiveness', '/training/competency'] },
  { id: 'ojt', name: 'On-Job Training', description: 'Create and maintain OJT records', href: '/training/ojt-planner', group: 'Training Execution', icon: Wrench, matchPaths: ['/training/ojt-planner', '/training/ojt'] },
  { id: 'external', name: 'External / Other Training', description: 'External and other training records', href: '/training/external', group: 'Training Execution', icon: Globe, matchPaths: ['/training/external', '/training/other-training'] },

  { id: 'history', name: 'Employee Training History', description: 'Active and deactivated employee records', href: '/training/history', group: 'Records & Compliance', icon: History, matchPaths: ['/training/history', '/training/employee-history', '/training/records'] },
  { id: 'reports', name: 'Reports', description: 'Human-readable PDF and Excel reports', href: '/training/reports', group: 'Records & Compliance', icon: FileText, matchPaths: ['/training/reports', '/training/report-center', '/training/analytics'] },
  { id: 'audit', name: 'Audit Trail', description: 'Secure time-stamped record history', href: '/training/audit-trail', group: 'Records & Compliance', icon: ShieldCheck, matchPaths: ['/training/audit-trail', '/training/audit', '/training/activity-log'] },
];

export const TMS_MODULE_GROUPS: TmsModuleGroup[] = [
  'Overview', 'Master Setup', 'Planning & Assignment', 'Training Execution',
  'Records & Compliance',
];

export function getModulesByGroup(group: TmsModuleGroup): TmsModuleDefinition[] {
  return ENTERPRISE_TMS_MODULES.filter((m) => m.group === group);
}

export function getModuleByHref(pathname: string): TmsModuleDefinition | undefined {
  return ENTERPRISE_TMS_MODULES.find((m) => {
    const paths = m.matchPaths ?? [m.href];
    return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  });
}

export const INDUCTION_WORKFLOW_STEPS = [
  'Employee Joins', 'HR Induction', 'Department Head Receives',
  'Job Description Assigned', 'Training Need Identification', 'Training Matrix Generated',
  'Required SOP Assigned', 'Required WI Assigned', 'Required Forms Assigned',
  'Training Schedule', 'Attendance', 'Questionnaire', 'Assessment',
  'Practical Evaluation', 'Competency Assessment', 'Approval', 'Certificate', 'Training Completed',
] as const;

export const AUTOMATION_RULES = [
  { id: 'auto-sop', label: 'Auto-assign SOP training after approval', enabled: true },
  { id: 'auto-revised-sop', label: 'Auto-assign revised SOP training', enabled: true },
  { id: 'auto-refresher', label: 'Auto-generate refresher training', enabled: true },
  { id: 'auto-induction', label: 'Auto-create induction for new employee', enabled: true },
  { id: 'auto-tni', label: 'Auto-create TNI from JD', enabled: true },
  { id: 'auto-trainer', label: 'Auto-assign trainer', enabled: true },
  { id: 'auto-notify-emp', label: 'Auto-notify employee', enabled: true },
  { id: 'auto-notify-hod', label: 'Auto-notify HOD', enabled: true },
  { id: 'auto-notify-qa', label: 'Auto-notify QA', enabled: true },
  { id: 'auto-certificate', label: 'Auto-generate certificate', enabled: true },
  { id: 'auto-renewal', label: 'Auto-schedule renewal', enabled: true },
  { id: 'auto-retraining', label: 'Auto-create retraining', enabled: true },
  { id: 'auto-archive', label: 'Auto-archive completed training', enabled: true },
] as const;

export const QMS_INTEGRATIONS = [
  'Employee Master', 'Department', 'Designation', 'Role', 'SOP', 'Work Instruction',
  'Forms', 'Change Control', 'CAPA', 'Deviation', 'Audit', 'Risk',
  'Document Management', 'Equipment', 'Validation', 'HRMS',
] as const;
