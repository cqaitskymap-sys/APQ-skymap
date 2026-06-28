import { z } from 'zod';

export const signatureVerifySchema = z.object({
  signature_id: z.string().min(1, 'Signature ID is required'),
  hash_value: z.string().optional(),
});

export type SignatureVerifyInput = z.infer<typeof signatureVerifySchema>;
