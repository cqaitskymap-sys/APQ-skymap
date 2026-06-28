import { z } from 'zod';
import { WATERMARK_TYPES, TRIGGER_EVENTS, VISIBILITY_TYPES, WATERMARK_POSITIONS, DOCUMENT_STATUSES } from './watermark-types';

export const createWatermarkTemplateSchema = z.object({
  template_name: z.string().min(1, 'Template name is required'),
  watermark_type: z.enum(WATERMARK_TYPES as unknown as [string, ...string[]]),
  display_text: z.string().min(1, 'Display text is required'),
  description: z.string().optional(),
  document_status: z.enum(DOCUMENT_STATUSES as unknown as [string, ...string[]]),
  applies_to: z.string().default('All Documents'),
  trigger_event: z.enum(TRIGGER_EVENTS as unknown as [string, ...string[]], { required_error: 'Trigger event is required' }),
  visibility: z.enum(VISIBILITY_TYPES as unknown as [string, ...string[]], { required_error: 'Visibility is required' }),
  position: z.enum(WATERMARK_POSITIONS as unknown as [string, ...string[]]).default('Diagonal'),
  rotation: z.number().min(-180).max(180).default(-45),
  opacity: z.number().min(0.05).max(1).default(0.25),
  font_family: z.string().default('Arial'),
  font_size: z.number().min(8).max(120).default(48),
  color: z.string().default('#CC0000'),
  repeat_pattern: z.string().default('Single'),
  qr_code_enabled: z.boolean().default(false),
  barcode_enabled: z.boolean().default(false),
  include_document_number: z.boolean().default(true),
  include_version: z.boolean().default(true),
  include_copy_number: z.boolean().default(false),
  include_print_date: z.boolean().default(true),
  include_user_name: z.boolean().default(false),
  include_department: z.boolean().default(false),
  include_timestamp: z.boolean().default(true),
  include_confidentiality_level: z.boolean().default(false),
  include_digital_fingerprint: z.boolean().default(false),
});

export const updateWatermarkRuleSchema = z.object({
  rule_name: z.string().min(1, 'Rule name is required'),
  template_id: z.string().min(1, 'Watermark template is required'),
  document_status: z.enum(DOCUMENT_STATUSES as unknown as [string, ...string[]], { required_error: 'Document status is required' }),
  document_type: z.string().default('All'),
  trigger_event: z.enum(TRIGGER_EVENTS as unknown as [string, ...string[]], { required_error: 'Trigger event is required' }),
  watermark_type: z.enum(WATERMARK_TYPES as unknown as [string, ...string[]]),
  priority: z.number().min(1).max(999).default(100),
});

export const applyWatermarkSchema = z.object({
  document_id: z.string().min(1, 'Document is required'),
  trigger_event: z.enum(TRIGGER_EVENTS as unknown as [string, ...string[]]),
  copy_number: z.string().optional(),
  watermark_type: z.string().optional(),
});

export const approveRuleSchema = z.object({
  signature_meaning: z.string().optional(),
  comments: z.string().optional(),
});

export const bulkAssignSchema = z.object({
  document_ids: z.array(z.string()).min(1, 'Select at least one document'),
  template_id: z.string().min(1, 'Watermark template is required'),
  trigger_event: z.enum(TRIGGER_EVENTS as unknown as [string, ...string[]]),
});

export type CreateWatermarkTemplateInput = z.infer<typeof createWatermarkTemplateSchema>;
export type UpdateWatermarkRuleInput = z.infer<typeof updateWatermarkRuleSchema>;
export type ApplyWatermarkInput = z.infer<typeof applyWatermarkSchema>;
export type ApproveRuleInput = z.infer<typeof approveRuleSchema>;
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;
