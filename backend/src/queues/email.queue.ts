import { Queue, JobsOptions } from 'bullmq';
import { redisConfig } from '../config/redis';
import { EmailJobData } from '../types';
import { logger } from '../utils/logger';

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: {
    age: 86400, // keep completed jobs for 24 hours
    count: 5000,
  },
  removeOnFail: {
    age: 86400 * 7, // keep failed jobs for 7 days
    count: 2000,
  },
};

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions,
});

emailQueue.on('error', (err) => {
  logger.error('BullMQ Email Queue error:', err);
});

export class QueueService {
  /**
   * Adds an email job to BullMQ with a calculated delay and stable deterministic job ID.
   * Using jobId ensures idempotency in BullMQ: duplicate adds with the same jobId are ignored.
   */
  public static async addDelayedEmailJob(
    data: EmailJobData,
    delayMs: number,
    stableJobId: string
  ) {
    const safeDelay = Math.max(0, Math.floor(delayMs));
    const job = await emailQueue.add('send-email', data, {
      jobId: stableJobId,
      delay: safeDelay,
    });
    return job;
  }

  /**
   * Checks whether a BullMQ job with the specified ID exists and is currently active or delayed.
   */
  public static async getJobStatus(jobId: string) {
    const job = await emailQueue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return {
      id: job.id,
      state,
      delay: job.opts.delay,
      timestamp: job.timestamp,
    };
  }

  /**
   * Retrieves queue metrics for monitoring.
   */
  public static async getQueueMetrics() {
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getDelayedCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      delayed,
      completed,
      failed,
      total: waiting + active + delayed + completed + failed,
    };
  }
}
