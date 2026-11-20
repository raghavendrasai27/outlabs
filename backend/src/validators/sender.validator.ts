import { z } from 'zod';

export const createSenderSchema = z.object({
  email: z.string().email('Valid email is required'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  smtpHost: z.string().optional().default('smtp.ethereal.email'),
  smtpPort: z.coerce.number().optional().default(587),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

export const updateSenderSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  isDefault: z.boolean().optional(),
});
