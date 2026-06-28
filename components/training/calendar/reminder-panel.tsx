'use client';

import { REMINDER_OFFSETS } from '@/lib/training-calendar-types';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReminderPanelProps {
  selected: string[];
  onChange: (reminders: string[]) => void;
}

export function ReminderPanel({ selected, onChange }: ReminderPanelProps) {
  const toggle = (offset: string) => {
    if (selected.includes(offset)) onChange(selected.filter((r) => r !== offset));
    else onChange([...selected, offset]);
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Reminder Schedule</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {REMINDER_OFFSETS.map((offset) => (
          <label key={offset} className="flex items-center gap-2 text-sm">
            <Checkbox checked={selected.includes(offset)} onCheckedChange={() => toggle(offset)} />
            <Label className="font-normal">{offset} before training</Label>
          </label>
        ))}
        <p className="text-xs text-muted-foreground pt-1">Email notifications are placeholders — reminders logged to audit trail.</p>
      </CardContent>
    </Card>
  );
}
