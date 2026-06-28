'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { normalizeRole } from '@/lib/permissions';
import {
  fetchCalendarDashboard, createTrainingEvent, updateTrainingEvent,
  cancelTrainingEvent, logCalendarViewed, processReminders,
} from '@/lib/training-calendar-service';
import { listEmployees as listTmsEmployees } from '@/lib/training-service';
import type { CalendarDashboardData, CalendarFilters, CalendarActor, TrainingEvent } from '@/lib/training-calendar-types';
import {
  canViewCalendar, canManageCalendar, isCalendarReadOnly, canViewOwnCalendar,
} from '@/lib/training-calendar-types';
import type { TrainingEventInput } from '@/lib/training-calendar-schemas';

export function useTrainingCalendar(filters?: CalendarFilters) {
  const { user, profile } = useAuth();
  const role = normalizeRole(profile?.role);
  const actor: CalendarActor = useMemo(() => ({
    id: user?.uid || '',
    name: profile?.full_name || '',
    role,
  }), [user?.uid, profile?.full_name, role]);

  const [data, setData] = useState<CalendarDashboardData | null>(null);
  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof listTmsEmployees>>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!canViewCalendar(role) && !canViewOwnCalendar(role)) {
      setError('You do not have permission to view the training calendar');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      await processReminders();
      const [dashboard, emps] = await Promise.all([
        fetchCalendarDashboard(filters),
        listTmsEmployees(),
      ]);
      setData(dashboard);
      setEmployees(emps);
      if (actor.id) await logCalendarViewed(actor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, actor, JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  const scopedEvents = useMemo(() => {
    if (!data) return [];
    if (canManageCalendar(role) || isCalendarReadOnly(role)) return data.events;
    if (canViewOwnCalendar(role) && actor.id) {
      return data.events.filter((e) =>
        e.assigned_employees.includes(actor.id)
        || e.waiting_list.includes(actor.id)
        || e.created_by === actor.id);
    }
    if (profile?.department) {
      return data.events.filter((e) => e.department === profile.department);
    }
    return data.events;
  }, [data, role, actor.id, profile?.department]);

  const createEvent = useCallback(async (input: TrainingEventInput) => {
    const nameMap = Object.fromEntries(employees.map((e) => [e.id, e.full_name]));
    const event = await createTrainingEvent(input, actor, nameMap);
    await refresh();
    return event;
  }, [actor, employees, refresh]);

  const updateEvent = useCallback(async (id: string, input: Partial<TrainingEventInput>) => {
    await updateTrainingEvent(id, input, actor);
    await refresh();
  }, [actor, refresh]);

  const cancelEvent = useCallback(async (id: string, reason?: string) => {
    await cancelTrainingEvent(id, actor, reason);
    await refresh();
  }, [actor, refresh]);

  return {
    data,
    events: scopedEvents,
    employees,
    loading,
    refreshing,
    error,
    role,
    actor,
    refresh,
    createEvent,
    updateEvent,
    cancelEvent,
    canView: canViewCalendar(role) || canViewOwnCalendar(role),
    canManage: canManageCalendar(role),
    isReadOnly: isCalendarReadOnly(role),
  };
}

export type { TrainingEvent, CalendarDashboardData };
