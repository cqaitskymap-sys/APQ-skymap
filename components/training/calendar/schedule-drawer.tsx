'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  trainingEventSchema, type TrainingEventInput,
} from '@/lib/training-calendar-schemas';
import {
  CALENDAR_TRAINING_TYPES, CALENDAR_MODES, EVENT_STATUSES, RECURRENCE_PATTERNS,
} from '@/lib/training-calendar-types';
import type { TrainingRoom, TrainerProfile, TrainingEvent } from '@/lib/training-calendar-types';
import type { EmployeeProfile } from '@/lib/training-types';
import { TMS_DEPARTMENTS } from '@/lib/training-types';
import { ReminderPanel } from './reminder-panel';
import { detectConflicts } from '@/lib/training-calendar-service';

interface ScheduleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TrainingEventInput) => Promise<void>;
  rooms: TrainingRoom[];
  trainers: TrainerProfile[];
  employees: EmployeeProfile[];
  initial?: TrainingEvent | null;
}

export function ScheduleDrawer({
  open, onOpenChange, onSubmit, rooms, trainers, employees, initial,
}: ScheduleDrawerProps) {
  const form = useForm<TrainingEventInput>({
    resolver: zodResolver(trainingEventSchema),
    defaultValues: {
      training_title: '',
      training_type: 'GMP',
      department: 'QA',
      trainer: '',
      room: '',
      mode: 'Classroom',
      capacity: 20,
      assigned_employees: [],
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      start_time: '09:00',
      end_time: '17:00',
      reminder_schedule: ['7 days', '1 day'],
      status: 'Draft',
      recurring: false,
      recurrence_pattern: 'None',
    },
  });

  const selectedEmployees = form.watch('assigned_employees') ?? [];
  const reminders = form.watch('reminder_schedule') ?? [];

  const toggleEmployee = (id: string) => {
    const current = form.getValues('assigned_employees') ?? [];
    form.setValue('assigned_employees',
      current.includes(id) ? current.filter((e) => e !== id) : [...current, id],
      { shouldValidate: true });
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      const conflicts = await detectConflicts(data, initial?.id);
      if (conflicts.length > 0) {
        toast.warning(conflicts.map((c) => c.message).join('; '));
      }
      await onSubmit(data);
      toast.success(initial ? 'Event updated' : 'Event scheduled');
      onOpenChange(false);
      form.reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save event');
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial ? 'Edit Training Event' : 'Schedule Training'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label>Training Title *</Label>
            <Input {...form.register('training_title')} />
            {form.formState.errors.training_title && <p className="text-xs text-red-600">{form.formState.errors.training_title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.watch('training_type')} onValueChange={(v) => form.setValue('training_type', v as TrainingEventInput['training_type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CALENDAR_TRAINING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={form.watch('department')} onValueChange={(v) => form.setValue('department', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TMS_DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Trainer *</Label>
              <Select value={form.watch('trainer')} onValueChange={(v) => form.setValue('trainer', v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select trainer" /></SelectTrigger>
                <SelectContent>{trainers.map((t) => <SelectItem key={t.id} value={t.full_name}>{t.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Room</Label>
              <Select value={form.watch('room')} onValueChange={(v) => form.setValue('room', v)}>
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.room_name}>{r.room_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mode</Label>
              <Select value={form.watch('mode')} onValueChange={(v) => form.setValue('mode', v as TrainingEventInput['mode'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CALENDAR_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Capacity</Label>
              <Input type="number" min={1} {...form.register('capacity')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Date *</Label><Input type="date" {...form.register('start_date')} /></div>
            <div><Label>End Date *</Label><Input type="date" {...form.register('end_date')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Time *</Label><Input type="time" {...form.register('start_time')} /></div>
            <div><Label>End Time *</Label><Input type="time" {...form.register('end_time')} /></div>
          </div>
          <div>
            <Label>Virtual Meeting Link</Label>
            <Input {...form.register('virtual_meeting_link')} placeholder="https://teams.microsoft.com/..." />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea {...form.register('description')} rows={2} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as TrainingEventInput['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Assign Employees ({selectedEmployees.length})</Label>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
              {employees.slice(0, 50).map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={selectedEmployees.includes(emp.id)} onCheckedChange={() => toggleEmployee(emp.id)} />
                  {emp.full_name} ({emp.department})
                </label>
              ))}
            </div>
          </div>
          <ReminderPanel selected={reminders} onChange={(r) => form.setValue('reminder_schedule', r)} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.watch('recurring')} onCheckedChange={(c) => form.setValue('recurring', !!c)} />
            Recurring training (annual GMP refresher)
          </label>
          {form.watch('recurring') && (
            <Select value={form.watch('recurrence_pattern')} onValueChange={(v) => form.setValue('recurrence_pattern', v as TrainingEventInput['recurrence_pattern'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RECURRENCE_PATTERNS.filter((p) => p !== 'None').map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save Event</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
