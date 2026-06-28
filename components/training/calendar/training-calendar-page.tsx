'use client';

import { useCallback, useState } from 'react';
import { Plus, RefreshCw, AlertTriangle, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/cpv/cpv-ui';
import { LoadingSkeleton } from '@/components/admin/dashboard/loading-skeleton';
import { ErrorCard } from '@/components/admin/dashboard/error-card';
import { ResponsiveDataTable } from '@/components/cpv/product-master/responsive-data-table';
import type { ColumnDef } from '@/components/admin/admin-data-table';
import { TmsPageHeader } from '@/components/training/tms-page-header';
import { useTrainingCalendar } from '@/hooks/use-training-calendar';
import { CALENDAR_VIEWS, EVENT_STATUSES, CALENDAR_TRAINING_TYPES, type TrainingEvent, type CalendarFilters } from '@/lib/training-calendar-types';
import { formatEventDateTime } from '@/lib/training-calendar-types';
import { CalendarView } from './calendar-view';
import { AgendaView } from './agenda-view';
import { TrainingEventCard } from './training-event-card';
import { ScheduleDrawer } from './schedule-drawer';
import { RoomAvailability, TrainerAvailability } from './room-availability';
import { CalendarDashboardCharts } from './calendar-dashboard-charts';
import { ExportMenu } from './export-menu';
import { CalendarStatusBadge } from './calendar-status-badge';
import type { TrainingEventInput } from '@/lib/training-calendar-schemas';

const KPI_CONFIG = [
  { label: "Today's Trainings", key: 'todaysTrainings' as const, tone: 'blue' as const },
  { label: 'Upcoming Trainings', key: 'upcomingTrainings' as const, tone: 'blue' as const },
  { label: 'Completed This Month', key: 'completedThisMonth' as const, tone: 'green' as const },
  { label: 'Cancelled Sessions', key: 'cancelledSessions' as const, tone: 'red' as const },
  { label: 'Pending Attendance', key: 'pendingAttendance' as const, tone: 'amber' as const },
  { label: 'Retraining Scheduled', key: 'retrainingScheduled' as const, tone: 'amber' as const },
  { label: 'Certificate Renewals Due', key: 'certificateRenewalsDue' as const, tone: 'amber' as const },
  { label: 'Trainer Utilization', key: 'trainerUtilization' as const, tone: 'green' as const, suffix: '%' },
  { label: 'Room Utilization', key: 'roomUtilization' as const, tone: 'green' as const, suffix: '%' },
];

interface TrainingCalendarPageProps {
  defaultTab?: 'calendar' | 'scheduler' | 'events';
}

export function TrainingCalendarPage({ defaultTab = 'calendar' }: TrainingCalendarPageProps) {
  const [filters, setFilters] = useState<CalendarFilters>({});
  const [calendarView, setCalendarView] = useState<string>('Month');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TrainingEvent | null>(null);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const {
    data, events, employees, loading, refreshing, error,
    refresh, createEvent, updateEvent, cancelEvent,
    canView, canManage, isReadOnly,
  } = useTrainingCalendar(filters);

  const today = new Date().toISOString().slice(0, 10);

  const handleSave = useCallback(async (input: TrainingEventInput) => {
    if (selectedEvent) await updateEvent(selectedEvent.id, input);
    else await createEvent(input);
    setSelectedEvent(null);
  }, [selectedEvent, createEvent, updateEvent]);

  const handleCancel = useCallback(async (id: string) => {
    if (!confirm('Cancel this training event?')) return;
    try {
      await cancelEvent(id, 'Cancelled by user');
      toast.success('Event cancelled');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel');
    }
  }, [cancelEvent]);

  const eventColumns: ColumnDef<TrainingEvent>[] = [
    { key: 'event_number', header: 'Event #', render: (e) => <span className="font-mono text-xs">{e.event_number}</span> },
    { key: 'training_title', header: 'Title', render: (e) => e.training_title },
    { key: 'training_type', header: 'Type', render: (e) => e.training_type },
    { key: 'trainer', header: 'Trainer', render: (e) => e.trainer },
    { key: 'schedule', header: 'Schedule', render: (e) => <span className="text-xs">{formatEventDateTime(e)}</span> },
    { key: 'status', header: 'Status', render: (e) => <CalendarStatusBadge status={e.status} /> },
    {
      key: 'enrolled',
      header: 'Enrolled',
      render: (e) => `${e.assigned_employees.length}/${e.capacity}${e.waiting_list.length ? ` (+${e.waiting_list.length} wait)` : ''}`,
    },
  ];

  if (!canView) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>You do not have permission to view the Training Calendar.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <TmsPageHeader
        title="Training Calendar & Scheduler"
        description="Plan, schedule and manage GMP training sessions across the organization."
        trail={[{ label: 'Calendar & Scheduler' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {data && <ExportMenu events={events} />}
            {canManage && !isReadOnly && (
              <Button onClick={() => { setSelectedEvent(null); setDrawerOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Schedule Training
              </Button>
            )}
          </div>
        }
      />

      {isReadOnly && (
        <Alert><AlertTitle>Read-Only Mode</AlertTitle><AlertDescription>Auditor access — view only.</AlertDescription></Alert>
      )}

      {error && <ErrorCard message={error} onRetry={refresh} />}

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search events…" className="max-w-xs" value={filters.search ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        <Select value={filters.department ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, department: v === 'all' ? undefined : v }))}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {Array.from(new Set(events.map((e) => e.department))).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : v }))}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {EVENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.trainingType ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, trainingType: v === 'all' ? undefined : v }))}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CALENDAR_TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={calendarView} onValueChange={setCalendarView}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{CALENDAR_VIEWS.slice(0, 4).map((v) => <SelectItem key={v} value={v}>{v} View</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? <LoadingSkeleton rows={6} /> : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {KPI_CONFIG.map(({ label, key, tone, suffix }) => (
              <KpiCard key={key} label={label} value={`${data.kpis[key]}${suffix ?? ''}`} tone={tone} />
            ))}
          </div>

          <CalendarDashboardCharts charts={data.charts} />

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="calendar"><CalendarDays className="h-3.5 w-3.5 mr-1" />Calendar</TabsTrigger>
              <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="rooms">Rooms & Trainers</TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-4 mt-4">
              <CalendarView
                events={events}
                view={calendarView}
                onSelectEvent={(e) => { setSelectedEvent(e); setDrawerOpen(true); }}
              />
            </TabsContent>

            <TabsContent value="scheduler" className="space-y-4 mt-4">
              <AgendaView events={events.filter((e) => !['Cancelled', 'Closed', 'Completed'].includes(e.status))} title="Scheduling Queue" />
              {canManage && !isReadOnly && (
                <Button onClick={() => { setSelectedEvent(null); setDrawerOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> New Schedule
                </Button>
              )}
            </TabsContent>

            <TabsContent value="events" className="mt-4">
              <ResponsiveDataTable
                data={events}
                columns={eventColumns}
                emptyMessage="No training events"
                searchKeys={['training_title', 'event_number', 'trainer']}
                mobileTitleKey="training_title"
                mobileSubtitleKey="event_number"
                actions={canManage && !isReadOnly ? (e) => (
                  e.status !== 'Cancelled' ? (
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(e.id)}>Cancel</Button>
                  ) : null
                ) : undefined}
              />
            </TabsContent>

            <TabsContent value="today" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AgendaView events={data.todaysSchedule} title="Today's Schedule" />
                <AgendaView events={data.upcomingEvents} title="Upcoming Events" />
              </div>
              <ResponsiveDataTable data={data.cancelledSessions} columns={eventColumns} emptyMessage="No cancelled sessions" mobileTitleKey="training_title" mobileSubtitleKey="event_number" />
            </TabsContent>

            <TabsContent value="rooms" className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <RoomAvailability rooms={data.rooms} events={events} date={today} />
              <TrainerAvailability trainers={data.trainers} events={events} date={today} />
            </TabsContent>
          </Tabs>

          {data.waitingListEvents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Waiting List</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.waitingListEvents.map((e) => (
                  <TrainingEventCard key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      {canManage && data && (
        <ScheduleDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onSubmit={handleSave}
          rooms={data.rooms}
          trainers={data.trainers}
          employees={employees}
          initial={selectedEvent}
        />
      )}
    </div>
  );
}
