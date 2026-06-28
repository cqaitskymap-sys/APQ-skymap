import { z } from 'zod';
import {
  LMS_AUTH_TYPES, LMS_SYNC_FREQUENCIES, LMS_SYNC_MODES,
  SUPPORTED_LMS_PLATFORMS, LMS_SYNC_ENTITIES,
} from './lms-types';

export const lmsConnectionSchema = z.object({
  connection_name: z.string().min(1, 'Connection name is required'),
  lms_name: z.enum(SUPPORTED_LMS_PLATFORMS as unknown as [string, ...string[]]),
  base_url: z.string().url('Valid base URL is required'),
  authentication_type: z.enum(LMS_AUTH_TYPES as unknown as [string, ...string[]]),
  client_id: z.string().optional().default(''),
  client_secret: z.string().optional().default(''),
  api_key: z.string().optional().default(''),
  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
  webhook_secret: z.string().optional().default(''),
  sync_mode: z.enum(LMS_SYNC_MODES as unknown as [string, ...string[]]).default('Manual'),
  sync_frequency: z.enum(LMS_SYNC_FREQUENCIES as unknown as [string, ...string[]]).default('On Demand'),
  sync_entities: z.array(z.enum(LMS_SYNC_ENTITIES as unknown as [string, ...string[]])).min(1, 'Select at least one entity'),
}).superRefine((data, ctx) => {
  const auth = data.authentication_type;
  if (auth === 'OAuth2' && (!data.client_id || !data.client_secret)) {
    ctx.addIssue({ code: 'custom', message: 'Client ID and Client Secret required for OAuth2', path: ['client_id'] });
  }
  if (auth === 'API Key' && !data.api_key) {
    ctx.addIssue({ code: 'custom', message: 'API Key is required', path: ['api_key'] });
  }
  if (auth === 'Basic Authentication' && (!data.username || !data.password)) {
    ctx.addIssue({ code: 'custom', message: 'Username and password required', path: ['username'] });
  }
  if ((auth === 'JWT' || auth === 'Bearer Token') && !data.api_key) {
    ctx.addIssue({ code: 'custom', message: 'Token is required', path: ['api_key'] });
  }
});

export const lmsFieldMappingSchema = z.object({
  eqmsField: z.string().min(1),
  lmsField: z.string().min(1),
  transform: z.string().optional(),
});

export type LmsConnectionInput = z.infer<typeof lmsConnectionSchema>;
export type LmsFieldMappingInput = z.infer<typeof lmsFieldMappingSchema>;
