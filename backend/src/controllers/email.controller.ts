import { Response, NextFunction } from 'express';
import { SchedulerService } from '../services/scheduler.service';
import { ElasticsearchService } from '../services/elasticsearch.service';
import { RateLimiterService } from '../services/rateLimiter.service';
import { QueueService } from '../queues/email.queue';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

export class EmailController {
  /**
   * POST /api/emails/schedule
   */
  public static async schedule(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        senderId,
        subject,
        body,
        recipients,
        csvContent,
        startTime,
        delayBetweenEmails,
        hourlyLimit,
      } = req.body;

      const result = await SchedulerService.scheduleEmails({
        userId: req.user!.id,
        senderId,
        subject,
        body,
        recipients,
        csvContent,
        startTime,
        delayBetweenEmails: delayBetweenEmails ? Number(delayBetweenEmails) : undefined,
        hourlyLimit: hourlyLimit ? Number(hourlyLimit) : undefined,
      });

      res.status(201).json({
        success: true,
        data: result,
        message: `Successfully scheduled ${result.scheduledCount} emails into persistent queue.`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/emails/scheduled
   */
  public static async getScheduled(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
      const skip = (page - 1) * limit;

      const where = {
        userId: req.user!.id,
        status: { in: ['scheduled', 'processing'] as any },
      };

      const [total, items] = await Promise.all([
        prisma.scheduledEmail.count({ where }),
        prisma.scheduledEmail.findMany({
          where,
          include: {
            sender: { select: { id: true, email: true, displayName: true } },
            campaign: { select: { id: true, subject: true } },
          },
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: limit,
        }),
      ]);

      res.json({
        success: true,
        data: {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/emails/sent
   */
  public static async getSent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
      const skip = (page - 1) * limit;

      const statusFilter = req.query.status as string | undefined;
      const allowedStatuses = statusFilter ? [statusFilter] : ['sent', 'failed'];

      const where = {
        userId: req.user!.id,
        status: { in: allowedStatuses as any },
      };

      const [total, items] = await Promise.all([
        prisma.scheduledEmail.count({ where }),
        prisma.scheduledEmail.findMany({
          where,
          include: {
            sender: { select: { id: true, email: true, displayName: true } },
            campaign: { select: { id: true, subject: true } },
          },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      res.json({
        success: true,
        data: {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/emails/search
   */
  public static async search(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, status, senderId, campaignId, page, limit } = req.query;

      const result = await ElasticsearchService.searchEmails({
        userId: req.user!.id,
        query: q as string | undefined,
        status: status as string | undefined,
        senderId: senderId as string | undefined,
        campaignId: campaignId as string | undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/emails/stats
   */
  public static async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const [totalEmails, scheduledEmails, sentEmails, failedEmails, defaultSender, queueMetrics] =
        await Promise.all([
          prisma.scheduledEmail.count({ where: { userId } }),
          prisma.scheduledEmail.count({
            where: { userId, status: { in: ['scheduled', 'processing'] } },
          }),
          prisma.scheduledEmail.count({ where: { userId, status: 'sent' } }),
          prisma.scheduledEmail.count({ where: { userId, status: 'failed' } }),
          prisma.sender.findFirst({ where: { userId, isDefault: true } }),
          QueueService.getQueueMetrics(),
        ]);

      let remainingInHour = 200;
      let hourWindow = RateLimiterService.getHourWindow();

      if (defaultSender) {
        const quota = await RateLimiterService.getSenderRemainingQuota(defaultSender.id);
        remainingInHour = quota.remaining;
        hourWindow = quota.hourWindow;
      }

      res.json({
        success: true,
        data: {
          totalEmails,
          scheduledEmails,
          sentEmails,
          failedEmails,
          remainingInHour,
          hourWindow,
          queueMetrics,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/emails/:id
   */
  public static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const email = await prisma.scheduledEmail.findFirst({
        where: { id, userId: req.user!.id },
        include: {
          sender: { select: { id: true, email: true, displayName: true } },
          campaign: true,
        },
      });

      if (!email) {
        throw new AppError('Email record not found', 404);
      }

      res.json({
        success: true,
        data: email,
      });
    } catch (error) {
      next(error);
    }
  }
}
