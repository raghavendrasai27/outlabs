import { prisma } from '../config/db';
import { emailQueue, QueueService } from '../queues/email.queue';
import { logger } from '../utils/logger';
import { EmailJobData } from '../types';

export interface RecoveryReport {
  scannedScheduled: number;
  scannedProcessing: number;
  restoredMissing: number;
  alreadyPresent: number;
  resetProcessing: number;
  errors: number;
}

export class RecoveryService {
  /**
   * Reconciles PostgreSQL email states with BullMQ queue jobs upon startup.
   * Prevents duplicate execution while restoring any lost/orphan jobs.
   */
  public static async reconcileJobs(): Promise<RecoveryReport> {
    logger.info('Starting Queue & Database Reconciliation on server startup...');

    const report: RecoveryReport = {
      scannedScheduled: 0,
      scannedProcessing: 0,
      restoredMissing: 0,
      alreadyPresent: 0,
      resetProcessing: 0,
      errors: 0,
    };

    try {
      // Find all emails currently marked as scheduled or processing
      const pendingEmails = await prisma.scheduledEmail.findMany({
        where: {
          status: { in: ['scheduled', 'processing'] },
        },
        include: {
          campaign: true,
          sender: true,
        },
      });

      const now = Date.now();

      for (const email of pendingEmails) {
        if (email.status === 'scheduled') {
          report.scannedScheduled++;
        } else if (email.status === 'processing') {
          report.scannedProcessing++;
        }

        const stableJobId = `email_${email.id}`;

        try {
          const existingJob = await emailQueue.getJob(stableJobId);

          if (existingJob) {
            const state = await existingJob.getState();
            // If job is already active, waiting, or delayed in BullMQ, don't touch it
            if (['delayed', 'waiting', 'active'].includes(state)) {
              report.alreadyPresent++;
              continue;
            }
          }

          // If the email was in 'processing' state when server abruptly died:
          // Check if it has been hanging for > 2 minutes without completing
          if (email.status === 'processing') {
            const timeSinceUpdate = now - email.updatedAt.getTime();
            if (timeSinceUpdate > 2 * 60 * 1000) {
              logger.warn(`Stale processing email detected: ${email.id} (stuck for ${Math.round(timeSinceUpdate / 1000)}s). Resetting to scheduled.`);
              await prisma.scheduledEmail.update({
                where: { id: email.id },
                data: { status: 'scheduled' },
              });
              report.resetProcessing++;
            } else {
              // Still potentially executing or recently touched, skip
              continue;
            }
          }

          // Job is missing in BullMQ; calculate remaining delay
          const targetTime = email.scheduledAt.getTime();
          const remainingDelay = Math.max(0, targetTime - now);

          const jobData: EmailJobData = {
            scheduledEmailId: email.id,
            campaignId: email.campaignId,
            userId: email.userId,
            senderId: email.senderId,
            recipientEmail: email.recipientEmail,
            subject: email.subject,
            body: email.body,
            scheduledAt: email.scheduledAt.toISOString(),
            idempotencyKey: email.idempotencyKey,
          };

          await QueueService.addDelayedEmailJob(jobData, remainingDelay, stableJobId);

          if (!email.bullJobId || email.bullJobId !== stableJobId) {
            await prisma.scheduledEmail.update({
              where: { id: email.id },
              data: { bullJobId: stableJobId },
            });
          }

          report.restoredMissing++;
          logger.info(`Restored orphan job into BullMQ: ${stableJobId} with ${remainingDelay}ms delay (recipient: ${email.recipientEmail})`);
        } catch (jobErr) {
          report.errors++;
          logger.error(`Error reconciling email record ${email.id}:`, jobErr);
        }
      }

      logger.info('Reconciliation completed successfully', report);
      return report;
    } catch (err) {
      logger.error('Fatal error during startup job reconciliation:', err);
      throw err;
    }
  }
}
