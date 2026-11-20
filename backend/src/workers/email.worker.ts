import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/redis';
import { EMAIL_QUEUE_NAME, QueueService } from '../queues/email.queue';
import { EmailJobData } from '../types';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { RateLimiterService } from '../services/rateLimiter.service';
import { EmailSenderService } from '../services/emailSender.service';
import { SlackService } from '../services/slack.service';
import { ElasticsearchService } from '../services/elasticsearch.service';
import { logger } from '../utils/logger';

export class EmailWorkerManager {
  private static worker: Worker<EmailJobData> | null = null;

  public static startWorker(): Worker<EmailJobData> {
    if (this.worker) return this.worker;

    logger.info(
      `Initializing BullMQ Persistent Worker for '${EMAIL_QUEUE_NAME}' (Concurrency: ${env.WORKER_CONCURRENCY})...`
    );

    this.worker = new Worker<EmailJobData>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailJobData>) => {
        return this.processEmailJob(job);
      },
      {
        connection: redisConfig,
        concurrency: env.WORKER_CONCURRENCY,
        limiter: {
          max: 1000,
          duration: 1000,
        },
      }
    );

    this.worker.on('active', (job) => {
      logger.info(`BullMQ Job ${job.id} started processing (Recipient: ${job.data.recipientEmail})`);
    });

    this.worker.on('completed', (job) => {
      logger.info(`BullMQ Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`BullMQ Job ${job?.id} failed with error:`, err.message);
    });

    this.worker.on('error', (err) => {
      logger.error('BullMQ Worker encountered internal error:', err);
    });

    return this.worker;
  }

  /**
   * Core execution pipeline for each email job.
   */
  private static async processEmailJob(job: Job<EmailJobData>): Promise<{ status: string; previewUrl?: string | false }> {
    const data = job.data;
    const { scheduledEmailId, senderId, recipientEmail, subject, body, userId } = data;

    // 1. Check current database state to guarantee idempotency
    const emailRecord = await prisma.scheduledEmail.findUnique({
      where: { id: scheduledEmailId },
      include: { campaign: true, sender: true },
    });

    if (!emailRecord) {
      logger.warn(`Scheduled email record ${scheduledEmailId} not found in database. Skipping.`);
      return { status: 'skipped_not_found' };
    }

    if (emailRecord.status === 'sent') {
      logger.info(`Email ${scheduledEmailId} already sent previously (Idempotent guard). Skipping.`);
      return { status: 'already_sent' };
    }

    // 2. Enforce minimum delay between emails via Redis coordination
    const minDelayWait = await RateLimiterService.enforceMinDelay(senderId, env.MIN_DELAY_BETWEEN_EMAILS_MS);
    if (minDelayWait > 0) {
      logger.info(`Throttling: waiting ${minDelayWait}ms to respect global min-delay between emails...`);
      await new Promise((resolve) => setTimeout(resolve, minDelayWait));
    }

    // 3. Hourly Rate Limit Check
    const hourlyLimit = emailRecord.campaign.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const reservation = await RateLimiterService.reserveSendingCapacity(senderId, hourlyLimit);

    if (!reservation.allowed) {
      // Limit exceeded: reschedule job into the next available hour window
      const waitDelay = reservation.waitDelayMs || 3600000;
      const nextWindowTime = reservation.nextWindowTime || new Date(Date.now() + waitDelay);

      logger.warn(
        `Rate limit reached for sender ${emailRecord.sender.email} (${reservation.currentCount}/${hourlyLimit}). Rescheduling job into next window in ${Math.round(waitDelay / 1000)}s.`
      );

      // Reschedule in BullMQ with remaining delay
      await QueueService.addDelayedEmailJob(data, waitDelay, `email_${scheduledEmailId}_retry_${Date.now()}`);

      // Update DB scheduled time
      await prisma.scheduledEmail.update({
        where: { id: scheduledEmailId },
        data: {
          scheduledAt: nextWindowTime,
          status: 'scheduled',
        },
      });

      // Dispatch Slack notification with Redis deduplication
      await SlackService.sendRateLimitAlert(userId, senderId, {
        senderEmail: emailRecord.sender.email,
        senderName: emailRecord.sender.displayName,
        hourlyLimit,
        hourWindow: reservation.hourWindow,
        delayedCount: 1,
        nextWindowTime,
      });

      return { status: 'rescheduled_rate_limit' };
    }

    // 4. Mark status as 'processing' in PostgreSQL
    await prisma.scheduledEmail.update({
      where: { id: scheduledEmailId },
      data: { status: 'processing' },
    });

    // 5. Send real email via Nodemailer & Ethereal SMTP
    try {
      const sendResult = await EmailSenderService.sendEmail({
        senderId,
        recipientEmail,
        subject,
        body,
      });

      const sentAt = new Date();
      const previewUrl = typeof sendResult.etherealPreviewUrl === 'string' ? sendResult.etherealPreviewUrl : null;

      // 6. Update PostgreSQL record to 'sent'
      await prisma.scheduledEmail.update({
        where: { id: scheduledEmailId },
        data: {
          status: 'sent',
          sentAt,
          etherealPreviewUrl: previewUrl,
          errorMessage: null,
        },
      });

      // 7. Update Elasticsearch document
      await ElasticsearchService.updateEmailStatus(scheduledEmailId, {
        status: 'sent',
        sentAt: sentAt.toISOString(),
        errorMessage: null,
      });

      return {
        status: 'sent',
        previewUrl: sendResult.etherealPreviewUrl,
      };
    } catch (smtpErr: any) {
      logger.error(`SMTP delivery failed for email ${scheduledEmailId}:`, smtpErr.message);

      // Record failure in PostgreSQL
      await prisma.scheduledEmail.update({
        where: { id: scheduledEmailId },
        data: {
          status: 'failed',
          errorMessage: smtpErr.message || 'SMTP delivery rejected',
        },
      });

      // Update Elasticsearch document
      await ElasticsearchService.updateEmailStatus(scheduledEmailId, {
        status: 'failed',
        errorMessage: smtpErr.message,
      });

      throw smtpErr;
    }
  }

  public static async stopWorker(): Promise<void> {
    if (this.worker) {
      logger.info('Shutting down BullMQ Persistent Worker gracefully...');
      await this.worker.close();
      this.worker = null;
      logger.info('BullMQ Persistent Worker closed.');
    }
  }
}
