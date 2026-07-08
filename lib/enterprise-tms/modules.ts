import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, CalendarDays, ClipboardList, Calendar, Grid3X3, FileSearch,
  Send, Clock, Users, UserCheck, CheckCircle, HelpCircle, PenTool, Award,
  FileText, ScrollText, GraduationCap, BadgeCheck, ListChecks, RefreshCw,
  ShieldCheck, BookOpen, AlertTriangle, UserPlus, Wrench, Globe, History,
  BarChart3, PieChart, Settings, Building2, FileCheck, Link2,
} from 'lucide-react';

export type TmsModuleGroup =
  | 'Overview'
  | 'Planning'
  | 'Execution'
  | 'Evaluation'
  | 'Records'
  | 'Trainer Management'
  | 'Training Programs'
  | 'Analytics'
  | 'Administration';

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

/** All 35 enterprise TMS modules */
export const ENTERPRISE_TMS_MODULES: TmsModuleDefinition[] = [
  { id: 'dashboard', name: 'Training Dashboard', description: 'Real-time KPIs, compliance, overdue & approvals', href: '/training', group: 'Overview', icon: LayoutDashboard, matchPaths: ['/training', '/training/dashboard'] },
  { id: 'calendar', name: 'Training Calendar', description: 'Events, rooms, trainer availability', href: '/training/calendar', group: 'Overview', icon: CalendarDays, matchPaths: ['/training/calendar', '/training/scheduler', '/training/events'] },
  { id: 'planner', name: 'Training Planner', description: 'Organizational training planning & kanban', href: '/training/planner', group: 'Planning', icon: ClipboardList },
  { id: 'annual-plan', name: 'Annual Training Plan', description: 'Yearly department training plans', href: '/training/annual-plan', group: 'Planning', icon: Calendar },
  { id: 'matrix', name: 'Training Matrix', description: 'Role × SOP × WI × competency mapping', href: '/training/matrix', group: 'Planning', icon: Grid3X3, matchPaths: ['/training/matrix', '/training/training-matrix'] },
  { id: 'tni', name: 'Training Need Identification', description: 'JD-based TNI → SOP assignment', href: '/training/tni', group: 'Planning', icon: FileSearch },
  { id: 'training-request', name: 'Training Request', description: 'Employee/HOD training requests', href: '/training/training-request', group: 'Planning', icon: Send },
  { id: 'schedule', name: 'Training Schedule', description: 'Session scheduling & assignments', href: '/training/scheduling', group: 'Execution', icon: Clock, matchPaths: ['/training/scheduling', '/training/schedule', '/training/assignments'] },
  { id: 'session', name: 'Training Session', description: 'Live session management', href: '/training/sessions', group: 'Execution', icon: Users },
  { id: 'attendance', name: 'Training Attendance', description: 'Attendance records & verification', href: '/training/attendance', group: 'Execution', icon: UserCheck, matchPaths: ['/training/attendance', '/training/completion'] },
  { id: 'evaluation', name: 'Training Evaluation', description: 'Post-training evaluations', href: '/training/effectiveness', group: 'Evaluation', icon: CheckCircle, matchPaths: ['/training/effectiveness'] },
  { id: 'questionnaire', name: 'Questionnaire', description: 'Question bank, MCQ, auto-evaluation', href: '/training/questionnaire', group: 'Evaluation', icon: HelpCircle },
  { id: 'assessment', name: 'Assessment', description: 'Written, practical & competency tests', href: '/training/assessment', group: 'Evaluation', icon: PenTool },
  { id: 'competency', name: 'Competency Assessment', description: 'Skill competency evaluation', href: '/training/competency', group: 'Evaluation', icon: Award },
  { id: 'practical', name: 'Practical Assessment', description: 'Hands-on practical evaluation', href: '/training/practical-assessment', group: 'Evaluation', icon: Wrench },
  { id: 'record', name: 'Training Record', description: 'Completed training records', href: '/training/records', group: 'Records', icon: FileText, matchPaths: ['/training/records'] },
  { id: 'certificate', name: 'Training Certificate', description: 'Issue, renew, verify certificates', href: '/training/certificates', group: 'Records', icon: ScrollText, matchPaths: ['/training/certificates', '/training/certificate-management', '/training/certificate-registry'] },
  { id: 'ttt', name: 'Train The Trainer', description: 'Trainer development program', href: '/training/train-the-trainer', group: 'Trainer Management', icon: GraduationCap },
  { id: 'trainer-qualification', name: 'Trainer Qualification', description: 'Trainer experience & qualification', href: '/training/trainer-qualification', group: 'Trainer Management', icon: BadgeCheck },
  { id: 'trainer-assessment', name: 'Trainer Assessment', description: 'Knowledge, presentation, practical skill', href: '/training/trainer-assessment', group: 'Trainer Management', icon: ListChecks },
  { id: 'certified-trainers', name: 'Certified Trainer List', description: 'Register of certified trainers', href: '/training/certified-trainers', group: 'Trainer Management', icon: Users },
  { id: 'trainer-certificate', name: 'Trainer Certificate', description: 'Trainer certification records', href: '/training/trainer-certificate', group: 'Trainer Management', icon: ScrollText },
  { id: 'trainer-renewal', name: 'Trainer Renewal', description: 'Trainer cert renewal workflow', href: '/training/trainer-renewal', group: 'Trainer Management', icon: RefreshCw },
  { id: 'effectiveness', name: 'Training Effectiveness', description: '30/60/90 day effectiveness review', href: '/training/effectiveness', group: 'Evaluation', icon: ShieldCheck },
  { id: 'srd', name: 'Self Reading Declaration', description: 'SOP read & understood declaration', href: '/training/srd', group: 'Training Programs', icon: FileCheck },
  { id: 'need-based', name: 'Need Based Training', description: 'CAPA, deviation, CC triggered training', href: '/training/need-based', group: 'Training Programs', icon: AlertTriangle },
  { id: 'refresher', name: 'Refresher Training', description: 'Periodic refresher scheduling', href: '/training/refresher', group: 'Training Programs', icon: RefreshCw, matchPaths: ['/training/refresher', '/training/retraining'] },
  { id: 'induction', name: 'Induction Training', description: 'HR → Dept → TNI → SOP workflow', href: '/training/induction', group: 'Training Programs', icon: Building2 },
  { id: 'new-employee', name: 'New Employee Training', description: 'New joiner training program', href: '/training/new-employee', group: 'Training Programs', icon: UserPlus },
  { id: 'ojt', name: 'On Job Training', description: 'OJT planner, matrix & checklist', href: '/training/ojt-planner', group: 'Training Programs', icon: Wrench },
  { id: 'external', name: 'External Training', description: 'Seminars, workshops, vendor training', href: '/training/external', group: 'Training Programs', icon: Globe },
  { id: 'history', name: 'Training History', description: 'Employee training timeline', href: '/training/history', group: 'Records', icon: History, matchPaths: ['/training/history', '/training/employee-history'] },
  { id: 'reports', name: 'Training Reports', description: 'Compliance & audit reports', href: '/training/reports', group: 'Analytics', icon: FileText, matchPaths: ['/training/reports', '/training/report-center'] },
  { id: 'analytics', name: 'Training Analytics', description: 'Trends, charts & performance', href: '/training/analytics', group: 'Analytics', icon: BarChart3 },
  { id: 'settings', name: 'Training Settings', description: 'Automation, thresholds & compliance', href: '/training/settings', group: 'Administration', icon: Settings },
];

export const TMS_MODULE_GROUPS: TmsModuleGroup[] = [
  'Overview', 'Planning', 'Execution', 'Evaluation', 'Records',
  'Trainer Management', 'Training Programs', 'Analytics', 'Administration',
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
