import { prisma } from '../config/db';
import { env } from '../config/env';
import { QueueService } from '../queues/email.queue';
import { RecipientParser } from '../utils/csvParser';
import { generateIdempotencyKey } from '../utils/idempotency';
import { ElasticsearchService } from './elasticsearch.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { EmailJobData, SchedulingResult } from '../types';

export interface ScheduleCampaignInput {
  userId: string;
  senderId?: string;
  subject: string;
  body: string;
  recipients?: string[] | string;
  csvContent?: string | Buffer;
  startTime?: string | Date;
  delayBetweenEmails?: number; // ms
  hourlyLimit?: number;
}

export class SchedulerService {
  /**
   * Validates, plans, and schedules an email campaign with persistent BullMQ delayed jobs.
   */
  public static async scheduleEmails(input: ScheduleCampaignInput): Promise<SchedulingResult> {
    const { userId, subject, body } = input;

    if (!subject || !subject.trim()) {
      throw new AppError('Email subject is required', 400);
    }
    if (!body || !body.trim()) {
      throw new AppError('Email body is required', 400);
    }

    // 1. Resolve & validate recipients
    let validEmails: string[] = [];
    let invalidEmails: string[] = [];

    if (input.csvContent) {
      const csvParsed = await RecipientParser.parseCsv(input.csvContent);
      validEmails = csvParsed.validEmails;
      invalidEmails = csvParsed.invalidEmails;
    } else if (input.recipients) {
      const listParsed = RecipientParser.parseEmailList(input.recipients);
      validEmails = listParsed.validEmails;
      invalidEmails = listParsed.invalidEmails;
    }

    if (validEmails.length === 0) {
      throw new AppError('No valid recipient email addresses found.', 400, {
        invalidEmails,
      });
    }

    // 2. Resolve sender
    let senderId = input.senderId;
    if (!senderId) {
      const defaultSender = await prisma.sender.findFirst({
        where: { userId, isDefault: true },
      });
      if (defaultSender) {
        senderId = defaultSender.id;
      } else {
        const anySender = await prisma.sender.findFirst({ where: { userId } });
        if (!anySender) {
          throw new AppError('No sender identity configured. Please connect a sender first.', 400);
        }
        senderId = anySender.id;
      }
    } else {
      const sender = await prisma.sender.findFirst({
        where: { id: senderId, userId },
      });
      if (!sender) {
        throw new AppError('Sender identity not found or unauthorized', 404);
      }
    }

    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (!sender) {
      throw new AppError('Sender not found', 404);
    }

    // 3. Scheduling parameters & rate-limit window calculation
    const delayBetween = Math.max(
      env.MIN_DELAY_BETWEEN_EMAILS_MS,
      input.delayBetweenEmails || env.MIN_DELAY_BETWEEN_EMAILS_MS
    );
    const hourlyLimit = Math.min(
      env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      input.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER
    );

    const now = Date.now();
    const startTimestamp = input.startTime ? new Date(input.startTime).getTime() : now;
    let runningClock = Math.max(now, startTimestamp);

    // Calculate sequential schedule times with hourly limit window bumping
    const scheduledItems: Array<{ recipient: string; scheduledAt: Date; idempotencyKey: string }> = [];
    let currentWindowHour = new Date(runningClock).getUTCHours();
    let emailsInCurrentWindow = 0;

    for (const recipient of validEmails) {
      const checkDate = new Date(runningClock);
      const checkHour = checkDate.getUTCHours();

      // If we crossed into a new UTC hour window, reset window counter
      if (checkHour !== currentWindowHour) {
        currentWindowHour = checkHour;
        emailsInCurrentWindow = 0;
      }

      // If window quota is reached, bump clock to start of next hour
      if (emailsInCurrentWindow >= hourlyLimit) {
        const nextHour = new Date(runningClock);
        nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
        runningClock = nextHour.getTime();
        currentWindowHour = nextHour.getUTCHours();
        emailsInCurrentWindow = 0;
      }

      const scheduledAt = new Date(runningClock);
      const idempotencyKey = generateIdempotencyKey({
        campaignId: 'temp', // will be replaced or bound
        recipientEmail: recipient,
        scheduledAt,
        subject,
      });

      scheduledItems.push({
        recipient,
        scheduledAt,
        idempotencyKey,
      });

      emailsInCurrentWindow++;
      runningClock += delayBetween;
    }

    const estimatedCompletionTime = new Date(runningClock);

    // 4. Create Campaign and ScheduledEmail records in PostgreSQL Transaction
    const campaign = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.emailCampaign.create({
        data: {
          userId,
          subject,
          body,
          startTime: new Date(Math.max(now, startTimestamp)),
          delayBetweenEmails: delayBetween,
          hourlyLimit,
          status: 'active',
        },
      });

      // Update idempotency keys with final campaignId
      const emailRecords = scheduledItems.map((item) => {
        const finalKey = generateIdempotencyKey({
          campaignId: newCampaign.id,
          recipientEmail: item.recipient,
          scheduledAt: item.scheduledAt,
          subject,
        });

        return {
          campaignId: newCampaign.id,
          userId,
          senderId,
          recipientEmail: item.recipient,
          subject,
          body,
          scheduledAt: item.scheduledAt,
          idempotencyKey: finalKey,
          status: 'scheduled' as const,
        };
      });

      // Bulk create emails
      await tx.scheduledEmail.createMany({
        data: emailRecords,
        skipDuplicates: true,
      });

      return newCampaign;
    });

    // 5. Query created emails to retrieve their generated IDs and push BullMQ delayed jobs
    const createdEmails = await prisma.scheduledEmail.findMany({
      where: { campaignId: campaign.id },
    });

    for (const email of createdEmails) {
      const stableJobId = `email_${email.id}`;
      const delayMs = Math.max(0, email.scheduledAt.getTime() - Date.now());

      const jobData: EmailJobData = {
        scheduledEmailId: email.id,
        campaignId: campaign.id,
        userId,
        senderId: sender.id,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        body: email.body,
        scheduledAt: email.scheduledAt.toISOString(),
        idempotencyKey: email.idempotencyKey,
      };

      await QueueService.addDelayedEmailJob(jobData, delayMs, stableJobId);

      // Save stable BullMQ Job ID to DB
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { bullJobId: stableJobId },
      });

      // Asynchronously index in Elasticsearch
      ElasticsearchService.indexEmail({
        id: email.id,
        campaignId: email.campaignId,
        userId: email.userId,
        senderId: email.senderId,
        senderEmail: sender.email,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        body: email.body,
        status: 'scheduled',
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: null,
        errorMessage: null,
        createdAt: email.createdAt.toISOString(),
      }).catch((e) => logger.warn(`ES indexing error for ${email.id}:`, e.message));
    }

    logger.info(
      `Campaign ${campaign.id} successfully scheduled: ${createdEmails.length} emails queued across BullMQ.`
    );

    return {
      campaignId: campaign.id,
      totalRecipients: validEmails.length + invalidEmails.length,
      scheduledCount: createdEmails.length,
      invalidCount: invalidEmails.length,
      estimatedCompletionTime,
      hourlyLimitApplied: hourlyLimit,
    };
  }
}
