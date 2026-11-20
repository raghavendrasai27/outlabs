import { Request, Response, NextFunction } from 'express';
import { SlackService } from '../services/slack.service';
import { AuthenticatedRequest } from '../types';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export class SlackController {
  public static connect(req: AuthenticatedRequest, res: Response): void {
    const url = SlackService.getAuthorizationUrl(req.user!.id);
    res.json({
      success: true,
      url,
    });
  }

  public static async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string; // userId passed in state
      const error = req.query.error as string;

      if (error) {
        res.redirect(`${env.FRONTEND_URL}/settings?slack_error=${encodeURIComponent(error)}`);
        return;
      }

      if (!code || !state) {
        throw new AppError('Missing code or state in Slack OAuth callback', 400);
      }

      await SlackService.handleOAuthCallback(code, state);
      res.redirect(`${env.FRONTEND_URL}/settings?slack_connected=true`);
    } catch (error) {
      next(error);
    }
  }

  public static async status(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await SlackService.getConnectionStatus(req.user!.id);
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async disconnect(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await SlackService.disconnectSlack(req.user!.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
