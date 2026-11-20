import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey } from '../src/utils/idempotency';

describe('Deterministic Idempotency Key Generation', () => {
  it('generates identical keys for identical parameters', () => {
    const scheduledAt = new Date('2026-11-20T12:00:00.000Z');
    const key1 = generateIdempotencyKey({
      campaignId: 'camp-123',
      recipientEmail: 'User@Example.COM',
      scheduledAt,
      subject: 'Welcome to ReachInbox',
    });

    const key2 = generateIdempotencyKey({
      campaignId: 'camp-123',
      recipientEmail: 'user@example.com ',
      scheduledAt: '2026-11-20T12:00:00.000Z',
      subject: 'Welcome to ReachInbox',
    });

    expect(key1).toBe(key2);
    expect(key1).toHaveLength(64); // SHA-256 hex string
  });

  it('generates distinct keys for different recipients or schedules', () => {
    const scheduledAt = new Date('2026-11-20T12:00:00.000Z');
    const key1 = generateIdempotencyKey({
      campaignId: 'camp-123',
      recipientEmail: 'user1@example.com',
      scheduledAt,
    });

    const key2 = generateIdempotencyKey({
      campaignId: 'camp-123',
      recipientEmail: 'user2@example.com',
      scheduledAt,
    });

    const key3 = generateIdempotencyKey({
      campaignId: 'camp-123',
      recipientEmail: 'user1@example.com',
      scheduledAt: new Date('2026-11-20T12:05:00.000Z'),
    });

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });
});
