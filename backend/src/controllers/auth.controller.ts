import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

export class AuthController {
  /**
   * GET /api/auth/google
   * Redirects to Google OAuth authorization consent screen.
   */
  public static googleRedirect(req: Request, res: Response, next: NextFunction): void {
    try {
      const state = req.query.state as string | undefined;
      const url = AuthService.getGoogleAuthUrl(state);
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/google/callback
   * Handles redirect callback from Google OAuth.
   */
  public static async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string;
      const error = req.query.error as string;

      if (error) {
        res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
        return;
      }

      if (!code) {
        throw new AppError('Authorization code missing in Google callback', 400);
      }

      const { token } = await AuthService.handleGoogleCallback(code);

      // Set secure HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect back to frontend
      res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * POST /api/auth/google
   * Supports client-side Google Login button sending ID token or auth code.
   */
  public static async googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { credential, code } = req.body;

      let result;
      if (credential) {
        result = await AuthService.verifyGoogleIdToken(credential);
      } else if (code) {
        result = await AuthService.handleGoogleCallback(code);
      } else {
        throw new AppError('Missing Google credential or authorization code', 400);
      }

      res.cookie('token', result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Retrieves profile of currently authenticated user.
   */
  public static getCurrentUser(req: AuthenticatedRequest, res: Response): void {
    res.json({
      success: true,
      user: req.user,
    });
  }

  /**
   * POST /api/auth/logout
   * Clears authentication cookie.
   */
  public static logout(req: Request, res: Response): void {
    res.clearCookie('token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  /**
   * POST /api/auth/demo
   * Creates or looks up an evaluation user in PostgreSQL,
   * auto-provisions a real default Ethereal sender, and issues a valid signed JWT.
   */
  public static async demoLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = (req.body.email || 'evaluator@reachinbox.ai').trim().toLowerCase();
      const name = (req.body.name || 'ReachInbox Evaluator').trim();
      const avatar =
        req.body.avatar ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
      const googleId = 'demo-user-' + Buffer.from(email).toString('hex').slice(0, 24);

      const result = await AuthService.findOrCreateUser({
        googleId,
        email,
        name,
        avatar,
      });

      res.cookie('token', result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  }
}
