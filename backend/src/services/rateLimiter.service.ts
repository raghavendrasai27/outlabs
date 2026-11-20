import { redisClient } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Lua script for atomic hourly rate limiting
// KEYS[1]: counter key (e.g. sender:123:hour:2026112016)
// ARGV[1]: limit (number)
// ARGV[2]: ttlSeconds (e.g. 7200)
// Returns: [allowed (1 or 0), current_count]
const HOURLY_RATE_LIMIT_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local current = tonumber(redis.call('get', key) or "0")

if current >= limit then
  return {0, current}
else
  local new_val = redis.call('incr', key)
  if new_val == 1 then
    redis.call('expire', key, ttl)
  end
  return {1, new_val}
end
`;

// Lua script for atomic minimum delay between emails
// KEYS[1]: last send timestamp key
// ARGV[1]: minDelayMs
// ARGV[2]: currentTimestampMs
// Returns: delayNeededMs (0 if allowed immediately, >0 if must wait)
const MIN_DELAY_COORDINATION_LUA = `
local key = KEYS[1]
local min_delay = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local last = tonumber(redis.call('get', key) or "0")
local elapsed = now - last

if elapsed < min_delay then
  return min_delay - elapsed
else
  redis.call('set', key, now, 'PX', min_delay * 5)
  return 0
end
`;

export class RateLimiterService {
  /**
   * Formats a Date into an hourly window key string (YYYYMMDDHH).
   */
  public static getHourWindow(date: Date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    return `${y}${m}${d}${h}`;
  }

  /**
   * Returns the exact Date corresponding to the start of the next hour window.
   */
  public static getNextHourStart(date: Date = new Date()): Date {
    const next = new Date(date);
    next.setUTCHours(next.getUTCHours() + 1, 0, 0, 0);
    return next;
  }

  /**
   * Checks and atomically increments hourly sending quota for a sender.
   * Returns { allowed: true, currentCount } or { allowed: false, currentCount, nextWindowTime, waitDelayMs }.
   */
  public static async reserveSendingCapacity(
    senderId: string,
    limit: number = env.MAX_EMAILS_PER_HOUR_PER_SENDER
  ): Promise<{
    allowed: boolean;
    currentCount: number;
    hourWindow: string;
    nextWindowTime?: Date;
    waitDelayMs?: number;
  }> {
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const key = `reachinbox:sender:${senderId}:hour:${hourWindow}`;

    try {
      const result = (await redisClient.eval(
        HOURLY_RATE_LIMIT_LUA,
        1,
        key,
        limit.toString(),
        '7200' // TTL 2 hours
      )) as [number, number];

      const allowed = result[0] === 1;
      const count = result[1];

      if (!allowed) {
        const nextWindow = this.getNextHourStart(now);
        const waitDelayMs = Math.max(1000, nextWindow.getTime() - now.getTime());
        logger.warn(
          `Sender ${senderId} reached hourly limit (${count}/${limit}). Next window starts in ${Math.round(waitDelayMs / 1000)}s.`
        );
        return {
          allowed: false,
          currentCount: count,
          hourWindow,
          nextWindowTime: nextWindow,
          waitDelayMs,
        };
      }

      return {
        allowed: true,
        currentCount: count,
        hourWindow,
      };
    } catch (err) {
      logger.error('Error executing hourly rate limit Lua script:', err);
      // Fail-safe: allow if Redis error, but log heavily
      return { allowed: true, currentCount: 0, hourWindow };
    }
  }

  /**
   * Enforces global/sender minimum delay between consecutive email dispatches.
   * If consecutive email is fired too quickly across any worker instance, returns the required sleep duration.
   */
  public static async enforceMinDelay(
    senderId: string,
    minDelayMs: number = env.MIN_DELAY_BETWEEN_EMAILS_MS
  ): Promise<number> {
    const key = `reachinbox:sender:${senderId}:last_sent_at`;
    const now = Date.now();

    try {
      const waitNeeded = (await redisClient.eval(
        MIN_DELAY_COORDINATION_LUA,
        1,
        key,
        minDelayMs.toString(),
        now.toString()
      )) as number;

      return Math.max(0, waitNeeded);
    } catch (err) {
      logger.error('Error coordinating min delay in Redis:', err);
      return 0;
    }
  }

  /**
   * Retrieves remaining email quota for a sender in the current hour window.
   */
  public static async getSenderRemainingQuota(
    senderId: string,
    limit: number = env.MAX_EMAILS_PER_HOUR_PER_SENDER
  ): Promise<{ used: number; remaining: number; limit: number; hourWindow: string }> {
    const hourWindow = this.getHourWindow();
    const key = `reachinbox:sender:${senderId}:hour:${hourWindow}`;
    const raw = await redisClient.get(key);
    const used = raw ? parseInt(raw, 10) : 0;
    return {
      used,
      remaining: Math.max(0, limit - used),
      limit,
      hourWindow,
    };
  }
}
