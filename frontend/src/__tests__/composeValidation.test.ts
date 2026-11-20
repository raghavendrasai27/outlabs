import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const composeSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  senderId: z.string().min(1, 'Sender is required'),
  recipients: z.array(z.string().email()).min(1, 'At least one recipient is required'),
  delayBetweenEmails: z.number().min(2000, 'Min delay is 2000ms'),
  hourlyLimit: z.number().min(1).max(1000),
});

describe('Compose Form Validation', () => {
  it('validates compliant campaign configuration', () => {
    const validData = {
      subject: 'Interview Invitation',
      body: 'Hello candidate, we would love to connect.',
      senderId: 'sender-uuid-1',
      recipients: ['applicant@example.com'],
      delayBetweenEmails: 2500,
      hourlyLimit: 200,
    };

    const result = composeSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects delays under minimum threshold (2000ms)', () => {
    const invalidData = {
      subject: 'Campaign',
      body: 'Hello',
      senderId: 'sender-1',
      recipients: ['user@test.com'],
      delayBetweenEmails: 500, // < 2000ms
      hourlyLimit: 100,
    };

    const result = composeSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('rejects campaigns with empty recipients', () => {
    const invalidData = {
      subject: 'Campaign',
      body: 'Hello',
      senderId: 'sender-1',
      recipients: [],
      delayBetweenEmails: 2000,
      hourlyLimit: 100,
    };

    const result = composeSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
