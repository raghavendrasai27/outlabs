import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

export class CampaignController {
  public static async getCampaigns(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaigns = await prisma.emailCampaign.findMany({
        where: { userId: req.user!.id },
        include: {
          _count: {
            select: { scheduledEmails: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: campaigns,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getCampaignById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const campaign = await prisma.emailCampaign.findFirst({
        where: { id, userId: req.user!.id },
        include: {
          scheduledEmails: {
            take: 100,
            orderBy: { scheduledAt: 'asc' },
          },
        },
      });

      if (!campaign) {
        throw new AppError('Campaign not found', 404);
      }

      res.json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      next(error);
    }
  }
}
