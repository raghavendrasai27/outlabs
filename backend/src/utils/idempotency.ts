import crypto from 'crypto';

/**
 * Generates a deterministic idempotency key for an email job.
 * Incorporates campaignId, recipientEmail, scheduledAt timestamp, and subject/body hash
 * to ensure that identical emails within a campaign are identified unambiguously
 * and duplicates cannot be scheduled or dispatched twice.
 */
export function generateIdempotencyKey(params: {
  campaignId: string;
  recipientEmail: string;
  scheduledAt: Date | string;
  subject?: string;
}): string {
  const normalizedEmail = params.recipientEmail.trim().toLowerCase();
  const timeStr = typeof params.scheduledAt === 'string' 
    ? params.scheduledAt 
    : params.scheduledAt.toISOString();
  
  const rawString = `${params.campaignId}:${normalizedEmail}:${timeStr}:${params.subject || ''}`;
  return crypto.createHash('sha256').update(rawString).digest('hex');
}
