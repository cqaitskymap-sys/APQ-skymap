import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Grid3X3, BookOpen, Building2, Briefcase, Clock,
  Layers, Target, Wrench, FilePlus, Globe, Calendar, Users, UserCheck,
  PenTool, GraduationCap, History, FileText, FileSearch, Settings,
} from 'lucide-react';

export type TmsModuleGroup =
  | 'Setup'
  | 'Training Programs'
  | 'Session & Assessment'
  | 'Records & Admin';

export interface TmsModuleDefinition {
  id: string;
  name: string;
  description: string;
  href: string;
  group: TmsModuleGroup;
  icon: LucideIcon;
  matchPaths?: string[];
  workflowId?: string;
}

/** LMS — navigation matches CO-LMS-URS-001 process flow diagrams */
export const ENTERPRISE_TMS_MODULES: TmsModuleDefinition[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Training overview, overdue, pending actions',
    href: '/training',
    group: 'Setup',
    icon: LayoutDashboard,
    matchPaths: ['/training', '/training/dashboard'],
  },

  // ── Setup (Content + Matrix diagrams) ──
  {
    id: 'content',
    name: 'Training Content',
    description: 'Groups, content types, documents, questionnaires, trainer setup, approval',
    href: '/training/content',
    group: 'Setup',
    icon: BookOpen,
    matchPaths: ['/training/content'],
    workflowId: 'training-content',
  },
  {
    id: 'matrix',
    name: 'Training Matrix',
    description: 'BU / Dept / Induction / JR matrix — create, approve, version',
    href: '/training/matrix',
    group: 'Setup',
    icon: Grid3X3,
    matchPaths: ['/training/matrix', '/training/training-matrix'],
    workflowId: 'training-matrix',
  },

  // ── Training Programs (diagram workflows) ──
  {
    id: 'induction',
    name: 'Induction Training',
    description: 'Create group → approve → schedule → attendance → trainer ack',
    href: '/training/induction',
    group: 'Training Programs',
    icon: Building2,
    matchPaths: ['/training/induction'],
    workflowId: 'induction',
  },
  {
    id: 'jr-assignment',
    name: 'JR Assignment',
    description: 'Select employee → JR template → approver → employee accept → JR assigned',
    href: '/training/jr-assignment',
    group: 'Training Programs',
    icon: Briefcase,
    matchPaths: ['/training/jr-assignment', '/training/job-description'],
    workflowId: 'jr-assignment',
  },
  {
    id: 'jr-training-schedule',
    name: 'JR Training Schedule',
    description: 'Is JR training required? → functional roles → mode → approval → assigned',
    href: '/training/jr-training-schedule',
    group: 'Training Programs',
    icon: Clock,
    matchPaths: ['/training/jr-training-schedule', '/training/scheduling', '/training/schedule', '/training/assignments'],
    workflowId: 'jr-training-schedule',
  },
  {
    id: 'multi-target',
    name: 'Multi Target Training',
    description: 'Multi-document session → schedule → trainees → approval → complete',
    href: '/training/multi-target-training',
    group: 'Training Programs',
    icon: Layers,
    matchPaths: ['/training/multi-target-training'],
    workflowId: 'multi-target-training',
  },
  {
    id: 'target-training',
    name: 'Target Training',
    description: 'Document training, remedial, waive off, reassign, close request',
    href: '/training/target-training',
    group: 'Training Programs',
    icon: Target,
    matchPaths: ['/training/target-training'],
    workflowId: 'target-training',
  },
  {
    id: 'ojt',
    name: 'On Job Training',
    description: 'Select trainees → session details → attachments → OJT created',
    href: '/training/ojt',
    group: 'Training Programs',
    icon: Wrench,
    matchPaths: ['/training/ojt', '/training/ojt-planner'],
    workflowId: 'ojt',
  },
  {
    id: 'other-training',
    name: 'Other Training Record',
    description: 'Manual training name, details, attachments',
    href: '/training/other-training',
    group: 'Training Programs',
    icon: FilePlus,
    matchPaths: ['/training/other-training'],
    workflowId: 'other-training',
  },
  {
    id: 'external',
    name: 'External Training',
    description: 'Trainee upload → coordinator approve/reject',
    href: '/training/external',
    group: 'Training Programs',
    icon: Globe,
    matchPaths: ['/training/external'],
    workflowId: 'external-training',
  },
  {
    id: 'annual-plan',
    name: 'Annual Training Calendar',
    description: 'BU (HR → Approver → QA) or Dept (Coordinator → Approver)',
    href: '/training/annual-plan',
    group: 'Training Programs',
    icon: Calendar,
    matchPaths: ['/training/annual-plan'],
    workflowId: 'atc-dept',
  },

  // ── Session & Assessment (execution diagrams) ──
  {
    id: 'session',
    name: 'Training Session',
    description: 'Create → HOD approve → conduct → attendance → exam → evaluate',
    href: '/training/sessions',
    group: 'Session & Assessment',
    icon: Users,
    matchPaths: ['/training/sessions'],
    workflowId: 'training-session',
  },
  {
    id: 'attendance',
    name: 'Attendance',
    description: 'Mark trainee present for classroom / induction sessions',
    href: '/training/completion',
    group: 'Session & Assessment',
    icon: UserCheck,
    matchPaths: ['/training/completion', '/training/attendance'],
  },
  {
    id: 'assessment',
    name: 'Assessment',
    description: 'Written, oral, practical, offline — pass/fail, lock/unlock',
    href: '/training/assessment',
    group: 'Session & Assessment',
    icon: PenTool,
    matchPaths: ['/training/assessment'],
    workflowId: 'jr-training-execution',
  },
  {
    id: 'trainer',
    name: 'Trainer',
    description: 'Unlock trainee, answer questions, approve/reject suggestions',
    href: '/training/trainer',
    group: 'Session & Assessment',
    icon: GraduationCap,
    matchPaths: ['/training/trainer'],
    workflowId: 'trainer-actions',
  },

  // ── Records & Admin ──
  {
    id: 'history',
    name: 'Training Records',
    description: 'Employee training history including deactivated users',
    href: '/training/history',
    group: 'Records & Admin',
    icon: History,
    matchPaths: ['/training/history', '/training/records'],
  },
  {
    id: 'reports',
    name: 'Training Reports',
    description: 'Induction, JR, target, overdue — PDF & Excel',
    href: '/training/reports',
    group: 'Records & Admin',
    icon: FileText,
    matchPaths: ['/training/reports'],
  },
  {
    id: 'audit-trail',
    name: 'Audit Trail',
    description: 'Electronic records audit trail',
    href: '/training/audit-trail',
    group: 'Records & Admin',
    icon: FileSearch,
    matchPaths: ['/training/audit-trail'],
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'Email notifications, reminders, overdue alerts',
    href: '/training/settings',
    group: 'Records & Admin',
    icon: Settings,
    matchPaths: ['/training/settings'],
  },
];

export const TMS_MODULE_GROUPS: TmsModuleGroup[] = [
  'Setup', 'Training Programs', 'Session & Assessment', 'Records & Admin',
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

// Re-export workflow constants for backward compatibility
export {
  INDUCTION_WORKFLOW_STEPS,
  JR_ASSIGNMENT_WORKFLOW_STEPS,
  TARGET_TRAINING_TYPES,
  AUTOMATION_RULES,
  QMS_INTEGRATIONS,
  LMS_USER_ROLES,
} from '@/lib/enterprise-tms/workflows';
