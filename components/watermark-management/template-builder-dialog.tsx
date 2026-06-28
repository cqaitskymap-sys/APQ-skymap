'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { WatermarkPreview } from '@/components/watermark-management/wm-ui';
import { createWatermarkTemplateSchema, type CreateWatermarkTemplateInput } from '@/lib/watermark-schemas';
import { createWatermarkTemplate } from '@/lib/watermark-service';
import type { WatermarkActor } from '@/lib/watermark-types';
import {
  WATERMARK_TYPES, TRIGGER_EVENTS, VISIBILITY_TYPES, WATERMARK_POSITIONS, DOCUMENT_STATUSES,
} from '@/lib/watermark-types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actor: WatermarkActor;
  onSuccess: () => void;
}

export function WatermarkTemplateBuilder({ open, onOpenChange, actor, onSuccess }: Props) {
  const form = useForm<CreateWatermarkTemplateInput>({
    resolver: zodResolver(createWatermarkTemplateSchema),
    defaultValues: {
      template_name: '', watermark_type: 'Controlled Copy', display_text: 'CONTROLLED COPY — DO NOT DUPLICATE',
      document_status: 'Effective', trigger_event: 'Print', visibility: 'Both',
      position: 'Diagonal', rotation: -45, opacity: 0.25, font_family: 'Arial', font_size: 48,
      color: '#CC0000', repeat_pattern: 'Single',
      qr_code_enabled: true, barcode_enabled: true,
      include_document_number: true, include_version: true, include_copy_number: true,
      include_print_date: true, include_timestamp: true,
      include_user_name: false, include_department: false,
      include_confidentiality_level: false, include_digital_fingerprint: true,
    },
  });

  const values = form.watch();

  const onSubmit = async (data: CreateWatermarkTemplateInput) => {
    try {
      await createWatermarkTemplate(data, actor);
      toast.success('Watermark template created');
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create template');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Watermark Template Builder</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input {...form.register('template_name')} />
              {form.formState.errors.template_name && <p className="text-xs text-red-600">{form.formState.errors.template_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Watermark Type</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" {...form.register('watermark_type')}>
                {WATERMARK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Display Text *</Label>
              <Input {...form.register('display_text')} />
            </div>
            <div className="space-y-2">
              <Label>Document Status *</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" {...form.register('document_status')}>
                {DOCUMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Trigger Event *</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" {...form.register('trigger_event')}>
                {TRIGGER_EVENTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Visibility *</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" {...form.register('visibility')}>
                {VISIBILITY_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" {...form.register('position')}>
                {WATERMARK_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Opacity ({values.opacity})</Label>
              <Input type="range" min={0.05} max={1} step={0.05} {...form.register('opacity', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label>Font Size</Label>
              <Input type="number" {...form.register('font_size', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input type="color" {...form.register('color')} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ['qr_code_enabled', 'QR Code'], ['barcode_enabled', 'Barcode'],
              ['include_document_number', 'Doc Number'], ['include_version', 'Version'],
              ['include_copy_number', 'Copy Number'], ['include_print_date', 'Print Date'],
              ['include_user_name', 'User Name'], ['include_department', 'Department'],
              ['include_timestamp', 'Timestamp'], ['include_digital_fingerprint', 'Fingerprint'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register(key)} /> {label}
              </label>
            ))}
          </div>

          <div>
            <Label className="mb-2 block">Live Preview</Label>
            <WatermarkPreview template={{
              id: 'preview', watermark_id: 'preview', template_name: values.template_name || 'Preview',
              watermark_type: values.watermark_type, display_text: values.display_text,
              description: '', document_status: values.document_status, applies_to: 'All',
              trigger_event: values.trigger_event, visibility: values.visibility,
              position: values.position, rotation: values.rotation ?? -45, opacity: values.opacity ?? 0.25,
              font_family: values.font_family || 'Arial', font_size: values.font_size ?? 48,
              color: values.color || '#CC0000', repeat_pattern: values.repeat_pattern || 'Single',
              background_image: '', qr_code_enabled: values.qr_code_enabled ?? false,
              barcode_enabled: values.barcode_enabled ?? false,
              include_document_number: values.include_document_number ?? false,
              include_version: values.include_version ?? false,
              include_copy_number: values.include_copy_number ?? false,
              include_print_date: values.include_print_date ?? false,
              include_user_name: values.include_user_name ?? false,
              include_department: values.include_department ?? false,
              include_timestamp: values.include_timestamp ?? false,
              include_confidentiality_level: values.include_confidentiality_level ?? false,
              include_digital_fingerprint: values.include_digital_fingerprint ?? false,
              status: 'Active', created_by: '', created_by_name: '', updated_by: '', updated_by_name: '',
              created_at: '', updated_at: '',
            }} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Create Template</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
