import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type QueryConstraint, type DocumentData,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { listEmployees, generateAssignmentNumber } from './training-service';
import { type TmsActor } from './training-types';
import {
  CALENDAR_COLLECTIONS, type TrainingEvent, type TrainingRoom, type TrainerProfile,
  type CalendarFilters, type CalendarDashboardData, type CalendarDashboardKpis,
  type CalendarDashboardCharts, type ScheduleConflict, type CalendarActor,
  generateEventNumber, generateEventId, eventsOverlap,
} from './training-calendar-types';
import type { TrainingEventInput } from './training-calendar-schemas';

function now() { return new Date().toISOString(); }
function db() { return getFirebaseFirestore(); }

async function audit(actor: CalendarActor, action: string, recordId: string, oldValue: unknown, newValue: unknown) {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Training Calendar', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason: '', ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
  try {
    await addDoc(collection(db(), CALENDAR_COLLECTIONS.auditTrail), {
      moduleName: 'Training Calendar',
      action,
      documentId: recordId,
      userId: actor.id,
      userName: actor.name,
      timestamp: now(),
      collectionName: CALENDAR_COLLECTIONS.events,
    });
  } catch { /* optional */ }
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  for (const role of roles) {
    try {
      await addDoc(collection(db(), CALENDAR_COLLECTIONS.notifications), {
        title, message, module: 'Training Calendar', record_id: recordId, target_role: role,
        read: false, created_at: now(),
      });
    } catch { /* optional */ }
  }
}

function mapEvent(id: string, data: Record<string, unknown>): TrainingEvent {
  return {
    id,
    event_id: String(data.event_id ?? id),
    event_number: String(data.event_number ?? ''),
    training_title: String(data.training_title ?? ''),
    training_type: String(data.training_type ?? ''),
    department: String(data.department ?? ''),
    trainer: String(data.trainer ?? ''),
    trainer_id: data.trainer_id ? String(data.trainer_id) : null,
    room: String(data.room ?? ''),
    room_id: data.room_id ? String(data.room_id) : null,
    virtual_meeting_link: String(data.virtual_meeting_link ?? ''),
    mode: String(data.mode ?? 'Classroom'),
    description: String(data.description ?? ''),
    capacity: Number(data.capacity ?? 0),
    assigned_employees: (data.assigned_employees as string[]) ?? [],
    assigned_employee_names: (data.assigned_employee_names as string[]) ?? [],
    attendance_count: Number(data.attendance_count ?? 0),
    waiting_list: (data.waiting_list as string[]) ?? [],
    waiting_list_names: (data.waiting_list_names as string[]) ?? [],
    start_date: String(data.start_date ?? ''),
    end_date: String(data.end_date ?? ''),
    start_time: String(data.start_time ?? ''),
    end_time: String(data.end_time ?? ''),
    time_zone: String(data.time_zone ?? 'UTC'),
    recurring: Boolean(data.recurring),
    recurrence_pattern: String(data.recurrence_pattern ?? 'None'),
    reminder_schedule: (data.reminder_schedule as string[]) ?? [],
    assessment_required: Boolean(data.assessment_required),
    certificate_issued: Boolean(data.certificate_issued),
    status: String(data.status ?? 'Draft'),
    assignment_ids: (data.assignment_ids as string[]) ?? [],
    created_by: String(data.created_by ?? ''),
    created_by_name: String(data.created_by_name ?? ''),
    updated_by: String(data.updated_by ?? ''),
    updated_by_name: String(data.updated_by_name ?? ''),
    created_at: String(data.created_at ?? ''),
    updated_at: String(data.updated_at ?? ''),
  };
}

export async function listTrainingEvents(filters?: CalendarFilters, max = 200): Promise<TrainingEvent[]> {
  const constraints: QueryConstraint[] = [orderBy('start_date', 'asc'), limit(max)];
  if (filters?.department) constraints.unshift(where('department', '==', filters.department));
  if (filters?.status) constraints.unshift(where('status', '==', filters.status));
  if (filters?.trainer) constraints.unshift(where('trainer', '==', filters.trainer));
  const snap = await getDocs(query(collection(db(), CALENDAR_COLLECTIONS.events), ...constraints));
  let events = snap.docs.map((d) => mapEvent(d.id, d.data()));

  if (filters?.trainingType) events = events.filter((e) => e.training_type === filters.trainingType);
  if (filters?.mode) events = events.filter((e) => e.mode === filters.mode);
  if (filters?.dateFrom) events = events.filter((e) => e.end_date >= filters.dateFrom!);
  if (filters?.dateTo) events = events.filter((e) => e.start_date <= filters.dateTo!);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    events = events.filter((e) =>
      e.training_title.toLowerCase().includes(q)
      || e.event_number.toLowerCase().includes(q)
      || e.trainer.toLowerCase().includes(q));
  }
  return events;
}

export async function getTrainingEvent(id: string): Promise<TrainingEvent | null> {
  const snap = await getDoc(doc(db(), CALENDAR_COLLECTIONS.events, id));
  if (!snap.exists()) return null;
  return mapEvent(snap.id, snap.data());
}

export async function detectConflicts(
  input: TrainingEventInput,
  excludeEventId?: string,
): Promise<ScheduleConflict[]> {
  const conflicts: ScheduleConflict[] = [];
  const existing = await listTrainingEvents();
  const active = existing.filter((e) =>
    e.id !== excludeEventId && !['Cancelled', 'Closed'].includes(e.status));

  for (const e of active) {
    if (!eventsOverlap(input, e)) continue;
    if (input.trainer && e.trainer === input.trainer) {
      conflicts.push({ type: 'trainer', message: `Trainer ${input.trainer} has conflict with ${e.training_title}`, conflictingEventId: e.id });
    }
    if (input.room && e.room && input.room === e.room) {
      conflicts.push({ type: 'room', message: `Room ${input.room} is booked for ${e.training_title}`, conflictingEventId: e.id });
    }
  }
  return conflicts;
}

export async function createTrainingEvent(
  input: TrainingEventInput,
  actor: CalendarActor,
  employeeNames: Record<string, string> = {},
  skipConflictCheck = false,
): Promise<TrainingEvent> {
  if (!skipConflictCheck) {
    const conflicts = await detectConflicts(input);
    if (conflicts.some((c) => c.type === 'trainer' || c.type === 'room')) {
      throw new Error(conflicts.map((c) => c.message).join('; '));
    }
  }

  const ts = now();
  const assigned = input.assigned_employees ?? [];
  const capacity = input.capacity;
  let mainList = assigned;
  let waitingList: string[] = [];
  if (assigned.length > capacity) {
    mainList = assigned.slice(0, capacity);
    waitingList = assigned.slice(capacity);
  }

  const payload = {
    event_id: generateEventId(),
    event_number: generateEventNumber(),
    ...input,
    assigned_employees: mainList,
    assigned_employee_names: mainList.map((id) => employeeNames[id] ?? id),
    waiting_list: waitingList,
    waiting_list_names: waitingList.map((id) => employeeNames[id] ?? id),
    attendance_count: 0,
    assignment_ids: [] as string[],
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: ts,
    updated_at: ts,
  };

  const ref = await addDoc(collection(db(), CALENDAR_COLLECTIONS.events), payload);
  await audit(actor, 'event created', ref.id, null, payload);

  if (input.status === 'Scheduled' || input.status === 'Open') {
    await assignEmployeesToEvent(ref.id, mainList, actor as TmsActor);
  }

  await notify('Training Scheduled', `${input.training_title} on ${input.start_date}`, ref.id, ['training_coordinator']);

  return mapEvent(ref.id, payload);
}

export async function assignEmployeesToEvent(
  eventId: string,
  employeeIds: string[],
  actor: TmsActor,
): Promise<void> {
  const event = await getTrainingEvent(eventId);
  if (!event) return;
  const employees = await listEmployees();
  const assignmentIds: string[] = [...event.assignment_ids];
  const ts = now();

  for (const empId of employeeIds) {
    const existing = await getDocs(query(
      collection(db(), CALENDAR_COLLECTIONS.assignments),
      where('employee_id', '==', empId),
      where('scheduled_date', '==', event.start_date),
      where('training_title', '==', event.training_title),
    ));
    if (!existing.empty) continue;

    const emp = employees.find((e) => e.id === empId);
    if (!emp) continue;

    const trainingNumber = await generateAssignmentNumber();
    const ref = await addDoc(collection(db(), CALENDAR_COLLECTIONS.assignments), {
      training_assignment_id: trainingNumber,
      training_number: trainingNumber,
      training_master_id: '',
      training_title: event.training_title,
      training_topic: event.training_title,
      training_type: event.training_type,
      employee_id: emp.id,
      employee_name: emp.full_name,
      department: emp.department,
      designation: emp.designation,
      assigned_date: event.start_date,
      due_date: event.end_date,
      scheduled_date: event.start_date,
      scheduled_time: event.start_time,
      training_mode: event.mode,
      completion_date: null,
      assessment_score: null,
      pass_fail: null,
      trainer_name: event.trainer,
      status: 'pending',
      training_status: 'Assigned',
      effectiveness_required: false,
      effectiveness_due_date: null,
      remarks: event.description,
      source: 'calendar_event',
      source_ref: eventId,
      retraining_of: null,
      created_by: actor.id,
      created_by_name: actor.name,
      updated_by: actor.id,
      updated_by_name: actor.name,
      created_at: ts,
      updated_at: ts,
    });
    assignmentIds.push(ref.id);
  }

  await updateDoc(doc(db(), CALENDAR_COLLECTIONS.events, eventId), {
    assignment_ids: assignmentIds,
    updated_at: ts,
  } as DocumentData);
}

export async function updateTrainingEvent(
  id: string,
  input: Partial<TrainingEventInput>,
  actor: CalendarActor,
): Promise<void> {
  const existing = await getTrainingEvent(id);
  if (!existing) throw new Error('Event not found');
  const merged = { ...existing, ...input };
  const conflicts = await detectConflicts(merged as TrainingEventInput, id);
  if (conflicts.some((c) => c.type === 'trainer' || c.type === 'room')) {
    throw new Error(conflicts.map((c) => c.message).join('; '));
  }
  const updates = { ...input, updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(db(), CALENDAR_COLLECTIONS.events, id), updates as DocumentData);
  await audit(actor, 'event updated', id, existing, updates);
}

export async function cancelTrainingEvent(id: string, actor: CalendarActor, reason = ''): Promise<void> {
  const existing = await getTrainingEvent(id);
  if (!existing) throw new Error('Event not found');
  await updateDoc(doc(db(), CALENDAR_COLLECTIONS.events, id), {
    status: 'Cancelled',
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
    description: reason ? `${existing.description}\nCancelled: ${reason}` : existing.description,
  });
  await audit(actor, 'event cancelled', id, existing, { status: 'Cancelled', reason });
  await notify('Training Cancelled', `${existing.training_title} has been cancelled`, id, ['training_coordinator']);
}

export async function listTrainingRooms(): Promise<TrainingRoom[]> {
  const snap = await getDocs(query(collection(db(), CALENDAR_COLLECTIONS.rooms), orderBy('room_name', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingRoom));
}

export async function listTrainers(): Promise<TrainerProfile[]> {
  const snap = await getDocs(query(collection(db(), CALENDAR_COLLECTIONS.trainers), orderBy('full_name', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerProfile));
}

export async function seedDefaultRoomsAndTrainers(): Promise<void> {
  const rooms = await listTrainingRooms();
  if (rooms.length === 0) {
    const defaults = [
      { room_code: 'CR-101', room_name: 'Conference Room A', location: 'QA Building', capacity: 30, equipment: 'Projector, Whiteboard', status: 'Active' },
      { room_code: 'CR-102', room_name: 'Training Hall B', location: 'Production Block', capacity: 50, equipment: 'AV System, Microphones', status: 'Active' },
      { room_code: 'VR-001', room_name: 'Virtual Room', location: 'Online', capacity: 100, equipment: 'Teams/Zoom', status: 'Active' },
    ];
    const ts = now();
    for (const r of defaults) {
      await addDoc(collection(db(), CALENDAR_COLLECTIONS.rooms), { ...r, created_at: ts, updated_at: ts });
    }
  }
  const trainers = await listTrainers();
  if (trainers.length === 0) {
    const ts = now();
    await addDoc(collection(db(), CALENDAR_COLLECTIONS.trainers), {
      trainer_id: 'TRN-001', full_name: 'Dr. Priya Sharma', email: 'priya.sharma@pharma.com',
      department: 'QA', specializations: ['GMP', 'GDP'], max_sessions_per_day: 4, status: 'Active', created_at: ts, updated_at: ts,
    });
    await addDoc(collection(db(), CALENDAR_COLLECTIONS.trainers), {
      trainer_id: 'TRN-002', full_name: 'Rajesh Kumar', email: 'rajesh.kumar@pharma.com',
      department: 'Production', specializations: ['SOP', 'Equipment'], max_sessions_per_day: 3, status: 'Active', created_at: ts, updated_at: ts,
    });
  }
}

function computeKpis(events: TrainingEvent[]): CalendarDashboardKpis {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7);
  const active = events.filter((e) => !['Cancelled', 'Closed'].includes(e.status));
  const todayEvents = active.filter((e) => e.start_date <= today && e.end_date >= today);
  const upcoming = active.filter((e) => e.start_date > today);
  const completedMonth = events.filter((e) =>
    e.status === 'Completed' && e.start_date.startsWith(monthStart));
  const cancelled = events.filter((e) => e.status === 'Cancelled');
  const pendingAtt = active.filter((e) =>
    ['Scheduled', 'Open', 'In Progress'].includes(e.status) && e.attendance_count < e.assigned_employees.length);
  const retraining = events.filter((e) => e.training_type === 'Retraining' && e.status === 'Scheduled');
  const certDue = events.filter((e) => e.certificate_issued && e.status === 'Scheduled');
  const trainerSessions = new Map<string, number>();
  const roomSessions = new Map<string, number>();
  active.forEach((e) => {
    if (e.trainer) trainerSessions.set(e.trainer, (trainerSessions.get(e.trainer) ?? 0) + 1);
    if (e.room) roomSessions.set(e.room, (roomSessions.get(e.room) ?? 0) + 1);
  });
  const maxTrainer = Math.max(1, ...Array.from(trainerSessions.values(), (v) => v));
  const maxRoom = Math.max(1, ...Array.from(roomSessions.values(), (v) => v));
  const avgTrainer = trainerSessions.size
    ? Math.round(Array.from(trainerSessions.values()).reduce((a, b) => a + b, 0) / trainerSessions.size / maxTrainer * 100)
    : 0;
  const avgRoom = roomSessions.size
    ? Math.round(Array.from(roomSessions.values()).reduce((a, b) => a + b, 0) / roomSessions.size / maxRoom * 100)
    : 0;

  return {
    todaysTrainings: todayEvents.length,
    upcomingTrainings: upcoming.length,
    completedThisMonth: completedMonth.length,
    cancelledSessions: cancelled.length,
    pendingAttendance: pendingAtt.length,
    retrainingScheduled: retraining.length,
    certificateRenewalsDue: certDue.length,
    trainerUtilization: avgTrainer,
    roomUtilization: avgRoom,
  };
}

function computeCharts(events: TrainingEvent[]): CalendarDashboardCharts {
  const last7: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7.push(d.toISOString().slice(0, 10));
  }

  const typeMap = new Map<string, number>();
  events.forEach((e) => typeMap.set(e.training_type, (typeMap.get(e.training_type) ?? 0) + 1));
  const deptMap = new Map<string, number>();
  events.filter((e) => e.status === 'Scheduled' || e.status === 'Open').forEach((e) =>
    deptMap.set(e.department, (deptMap.get(e.department) ?? 0) + 1));
  const trainerMap = new Map<string, number>();
  events.forEach((e) => trainerMap.set(e.trainer, (trainerMap.get(e.trainer) ?? 0) + 1));
  const roomMap = new Map<string, number>();
  events.filter((e) => e.room).forEach((e) => roomMap.set(e.room, (roomMap.get(e.room) ?? 0) + 1));

  return {
    monthlyCalendar: last7.map((date) => ({
      date: date.slice(5),
      count: events.filter((e) => e.start_date <= date && e.end_date >= date).length,
    })),
    typeDistribution: Array.from(typeMap.entries()).map(([name, value]) => ({ name, value })),
    departmentSchedule: Array.from(deptMap.entries()).map(([name, value]) => ({ name, value })),
    trainerWorkload: Array.from(trainerMap.entries()).map(([name, value]) => ({ name, value })).slice(0, 10),
    attendanceTrend: last7.map((date) => ({
      date: date.slice(5),
      present: events.filter((e) => e.start_date === date).reduce((s, e) => s + e.attendance_count, 0),
      absent: events.filter((e) => e.start_date === date).reduce((s, e) => s + Math.max(0, e.assigned_employees.length - e.attendance_count), 0),
    })),
    completionTrend: last7.map((date) => ({
      date: date.slice(5),
      count: events.filter((e) => e.status === 'Completed' && e.end_date === date).length,
    })),
    roomUtilization: Array.from(roomMap.entries()).map(([name, value]) => ({ name, value })),
    upcomingSchedule: events
      .filter((e) => e.start_date >= new Date().toISOString().slice(0, 10) && !['Cancelled', 'Closed'].includes(e.status))
      .slice(0, 10)
      .map((e) => ({ date: e.start_date, title: e.training_title, trainer: e.trainer })),
  };
}

export async function fetchCalendarDashboard(filters?: CalendarFilters): Promise<CalendarDashboardData> {
  await seedDefaultRoomsAndTrainers();
  const [events, rooms, trainers] = await Promise.all([
    listTrainingEvents(filters),
    listTrainingRooms(),
    listTrainers(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  return {
    kpis: computeKpis(events),
    charts: computeCharts(events),
    events,
    todaysSchedule: events.filter((e) => e.start_date <= today && e.end_date >= today && !['Cancelled'].includes(e.status)),
    upcomingEvents: events.filter((e) => e.start_date >= today && !['Cancelled', 'Closed'].includes(e.status)).slice(0, 20),
    cancelledSessions: events.filter((e) => e.status === 'Cancelled').slice(0, 10),
    waitingListEvents: events.filter((e) => e.waiting_list.length > 0).slice(0, 10),
    recentCompleted: events.filter((e) => e.status === 'Completed').slice(-10).reverse(),
    rooms,
    trainers,
  };
}

export function exportEventsCsv(events: TrainingEvent[]): void {
  const headers = ['Event Number', 'Title', 'Type', 'Department', 'Trainer', 'Room', 'Date', 'Time', 'Status', 'Capacity', 'Assigned'];
  const rows = events.map((e) => [
    e.event_number, e.training_title, e.training_type, e.department, e.trainer, e.room,
    e.start_date, `${e.start_time}-${e.end_time}`, e.status, e.capacity, e.assigned_employees.length,
  ]);
  downloadCsv('training-calendar.csv', headers, rows);
}

export function exportEventsIcs(events: TrainingEvent[]): void {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//APQ eQMS//Training Calendar//EN'];
  for (const e of events) {
    const dtStart = e.start_date.replace(/-/g, '') + 'T' + e.start_time.replace(':', '') + '00';
    const dtEnd = e.end_date.replace(/-/g, '') + 'T' + e.end_time.replace(':', '') + '00';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.event_id}@apq-skymap.com`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${e.training_title}`,
      `DESCRIPTION:${e.description || e.training_type}`,
      `LOCATION:${e.room || e.virtual_meeting_link || 'TBD'}`,
      `STATUS:${e.status === 'Cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'training-calendar.ics';
  link.click();
  URL.revokeObjectURL(url);
}

export async function logCalendarViewed(actor: CalendarActor): Promise<void> {
  await audit(actor, 'calendar viewed', 'dashboard', null, { viewed_at: now() });
}

export async function processReminders(): Promise<number> {
  const events = await listTrainingEvents({ status: 'Scheduled' });
  let sent = 0;
  const today = new Date();
  for (const e of events) {
    const eventDate = new Date(e.start_date);
    const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000);
    const offsets = e.reminder_schedule ?? [];
    if (offsets.includes('30 days') && daysUntil === 30) sent++;
    if (offsets.includes('14 days') && daysUntil === 14) sent++;
    if (offsets.includes('7 days') && daysUntil === 7) sent++;
    if (offsets.includes('1 day') && daysUntil === 1) sent++;
  }
  return sent;
}
