import { describe, it, expect } from 'vitest';
import { RateLimiterService } from '../src/services/rateLimiter.service';

describe('Rate Limiter Windows & Quota Planning', () => {
  it('correctly calculates hourly window format YYYYMMDDHH', () => {
    const fixedDate = new Date('2026-11-20T14:35:10.000Z');
    const window = RateLimiterService.getHourWindow(fixedDate);
    expect(window).toBe('2026112014');
  });

  it('correctly calculates the start of the next hour window', () => {
    const fixedDate = new Date('2026-11-20T14:35:10.000Z');
    const nextStart = RateLimiterService.getNextHourStart(fixedDate);

    expect(nextStart.toISOString()).toBe('2026-11-20T15:00:00.000Z');
    expect(nextStart.getTime()).toBeGreaterThan(fixedDate.getTime());
  });
});
