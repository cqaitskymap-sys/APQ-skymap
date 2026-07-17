export const CALENDAR_COLLECTIONS = {
  events: 'training_events',
  schedule: 'training_schedule',
  rooms: 'training_rooms',
  trainers: 'trainers',
  retraining: 'retraining_records',
  assignments: 'training_assignments',
  records: 'training_records',
  attendance: 'training_attendance',
  certificates: 'training_certificates',
  sessions: 'training_assignments_sessions',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
  profiles: 'profiles',
  departments: 'departments',
} as const;

export const CALENDAR_TRAINING_TYPES = [
  'GMP', 'GDP', 'Data Integrity', 'CSV', 'SOP', 'Safety', 'Equipment',
  'Validation', 'Quality', 'CAPA', 'Deviation', 'OOS', 'OOT',
  'Cyber Security', 'Role Based', 'Refresher', 'Retraining', 'Emergency Training',
] as const;

export const EVENT_STATUSES = [
  'Draft', 'Scheduled', 'Open', 'In Progress', 'Completed',
  'Cancelled', 'Postponed', 'Closed',
] as const;

export const CALENDAR_MODES = ['Classroom', 'Virtual', 'Hybrid', 'On-the-Job', 'Self-Study'] as const;

export const CALENDAR_VIEWS = [
  'Day', 'Week', 'Month', 'Agenda',
  'Department Calendar', 'Trainer Calendar', 'Employee Calendar', 'Room Calendar',
] as const;

export const RECURRENCE_PATTERNS = [
  'None', 'Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly', 'Yearly',
] as const;

export const REMINDER_OFFSETS = ['30 days', '14 days', '7 days', '1 day', '1 hour'] as const;

export type CalendarTrainingType = typeof CALENDAR_TRAINING_TYPES[number];
export type EventStatus = typeof EVENT_STATUSES[number];
export type CalendarMode = typeof CALENDAR_MODES[number];
export type CalendarView = typeof CALENDAR_VIEWS[number];
export type RecurrencePattern = typeof RECURRENCE_PATTERNS[number];

export interface CalendarActor {
  id: string;
  name: string;
  role: string;
}

export interface TrainingRoom {
  id: string;
  room_code: string;
  room_name: string;
  location: string;
  capacity: number;
  equipment: string;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface TrainerProfile {
  id: string;
  trainer_id: string;
  full_name: string;
  email: string;
  department: string;
  specializations: string[];
  max_sessions_per_day: number;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface TrainingEvent {
  id: string;
  event_id: string;
  event_number: string;
  training_title: string;
  training_type: CalendarTrainingType | string;
  department: string;
  trainer: string;
  trainer_id: string | null;
  room: string;
  room_id: string | null;
  virtual_meeting_link: string;
  mode: CalendarMode | string;
  description: string;
  capacity: number;
  assigned_employees: string[];
  assigned_employee_names: string[];
  attendance_count: number;
  waiting_list: string[];
  waiting_list_names: string[];
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  time_zone: string;
  recurring: boolean;
  recurrence_pattern: RecurrencePattern | string;
  reminder_schedule: string[];
  assessment_required: boolean;
  certificate_issued: boolean;
  status: EventStatus | string;
  assignment_ids: string[];
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export type { RetrainingRecord } from './training-retraining-types';

export interface CalendarFilters {
  department?: string;
  trainer?: string;
  trainingType?: string;
  status?: string;
  location?: string;
  mode?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ScheduleConflict {
  type: 'trainer' | 'room' | 'capacity';
  message: string;
  conflictingEventId?: string;
}

export interface CalendarDashboardKpis {
  todaysTrainings: number;
  upcomingTrainings: number;
  completedThisMonth: number;
  cancelledSessions: number;
  pendingAttendance: number;
  retrainingScheduled: number;
  certificateRenewalsDue: number;
  trainerUtilization: number;
  roomUtilization: number;
}

export interface CalendarDashboardCharts {
  monthlyCalendar: { date: string; count: number }[];
  typeDistribution: { name: string; value: number }[];
  departmentSchedule: { name: string; value: number }[];
  trainerWorkload: { name: string; value: number }[];
  attendanceTrend: { date: string; present: number; absent: number }[];
  completionTrend: { date: string; count: number }[];
  roomUtilization: { name: string; value: number }[];
  upcomingSchedule: { date: string; title: string; trainer: string }[];
}

export interface CalendarDashboardData {
  kpis: CalendarDashboardKpis;
  charts: CalendarDashboardCharts;
  events: TrainingEvent[];
  todaysSchedule: TrainingEvent[];
  upcomingEvents: TrainingEvent[];
  cancelledSessions: TrainingEvent[];
  waitingListEvents: TrainingEvent[];
  recentCompleted: TrainingEvent[];
  rooms: TrainingRoom[];
  trainers: TrainerProfile[];
}

export function isCalendarReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canManageCalendar(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'training_coordinator'].includes(role);
}

export function canApproveCalendarEvents(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(role);
}

export function canManageAssignedSessions(role: string): boolean {
  return canManageCalendar(role) || role === 'trainer';
}

export function canViewDepartmentCalendar(role: string): boolean {
  return canManageCalendar(role)
    || canApproveCalendarEvents(role)
    || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(role);
}

export function canViewCalendar(role: string): boolean {
  return canViewDepartmentCalendar(role) || isCalendarReadOnly(role) || !['employee', 'production', 'qc', 'warehouse'].includes(role);
}

export function canViewOwnCalendar(role: string): boolean {
  return !canViewDepartmentCalendar(role) && !isCalendarReadOnly(role);
}

export function generateEventNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `TEV-${year}-${rand}`;
}

export function generateEventId(): string {
  return `EVT-${Date.now().toString(36).toUpperCase()}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function eventsOverlap(
  a: { start_date: string; end_date: string; start_time: string; end_time: string },
  b: { start_date: string; end_date: string; start_time: string; end_time: string },
): boolean {
  if (a.end_date < b.start_date || b.end_date < a.start_date) return false;
  if (a.start_date !== b.start_date && a.end_date !== b.start_date) {
    if (a.start_date <= b.start_date && a.end_date >= b.start_date) return true;
    if (b.start_date <= a.start_date && b.end_date >= a.start_date) return true;
    return a.start_date === b.start_date;
  }
  return timeToMinutes(a.start_time) < timeToMinutes(b.end_time)
    && timeToMinutes(b.start_time) < timeToMinutes(a.end_time);
}

export function formatEventDateTime(event: TrainingEvent): string {
  const date = event.start_date === event.end_date
    ? event.start_date
    : `${event.start_date} – ${event.end_date}`;
  return `${date} ${event.start_time}–${event.end_time}`;
}
