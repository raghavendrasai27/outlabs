import { Response, NextFunction } from 'express';
import { SenderService } from '../services/sender.service';
import { AuthenticatedRequest } from '../types';
import { createSenderSchema, updateSenderSchema } from '../validators/sender.validator';

export class SenderController {
  public static async getSenders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const senders = await SenderService.getSendersForUser(req.user!.id);
      res.json({
        success: true,
        data: senders,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async createSender(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createSenderSchema.parse(req.body);
      const sender = await SenderService.createSender(req.user!.id, validated);
      res.status(201).json({
        success: true,
        data: sender,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async createEtherealSender(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { displayName } = req.body;
      const sender = await SenderService.createEtherealSender(req.user!.id, displayName);
      res.status(201).json({
        success: true,
        data: sender,
        message: 'New Ethereal test sender account successfully generated',
      });
    } catch (error) {
      next(error);
    }
  }

  public static async updateSender(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validated = updateSenderSchema.parse(req.body);
      const sender = await SenderService.updateSender(req.user!.id, id, validated);
      res.json({
        success: true,
        data: sender,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async deleteSender(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await SenderService.deleteSender(req.user!.id, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
