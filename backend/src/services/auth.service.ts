import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { AuthUser } from '../types';
import nodemailer from 'nodemailer';
import { encrypt } from '../utils/encryption';

const googleClient = new OAuth2Client({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_CALLBACK_URL,
});

export class AuthService {
  /**
   * Generates the Google OAuth 2.0 authorization URL.
   */
  public static getGoogleAuthUrl(state?: string): string {
    return googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'consent',
      state: state || undefined,
    });
  }

  /**
   * Handles Google OAuth callback with authorization code.
   */
  public static async handleGoogleCallback(code: string): Promise<{ token: string; user: AuthUser }> {
    try {
      const { tokens } = await googleClient.getToken(code);
      googleClient.setCredentials(tokens);

      let googleId = '';
      let email = '';
      let name = '';
      let avatar: string | null = null;

      if (tokens.id_token) {
        const ticket = await googleClient.verifyIdToken({
          idToken: tokens.id_token,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (payload) {
          googleId = payload.sub;
          email = payload.email || '';
          name = payload.name || payload.email?.split('@')[0] || 'User';
          avatar = payload.picture || null;
        }
      }

      if (!email || !googleId) {
        throw new AppError('Failed to retrieve user information from Google OAuth', 400);
      }

      return await this.findOrCreateUser({ googleId, email, name, avatar });
    } catch (error: any) {
      logger.error('Error handling Google OAuth callback:', error);
      throw new AppError(error.message || 'Google OAuth authentication failed', 400);
    }
  }

  /**
   * Verifies Google ID token from frontend Google Identity Services button / One Tap.
   */
  public static async verifyGoogleIdToken(idToken: string): Promise<{ token: string; user: AuthUser }> {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new AppError('Invalid Google credential token', 400);
      }

      return await this.findOrCreateUser({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        avatar: payload.picture || null,
      });
    } catch (error: any) {
      logger.error('Error verifying Google ID token:', error);
      throw new AppError('Google token verification failed', 401);
    }
  }

  /**
   * Helper to find or create user and ensure initial default Ethereal sender exists.
   */
  public static async findOrCreateUser(data: {
    googleId: string;
    email: string;
    name: string;
    avatar: string | null;
  }): Promise<{ token: string; user: AuthUser }> {
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: data.googleId }, { email: data.email }],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: data.googleId,
          email: data.email,
          name: data.name,
          avatar: data.avatar,
        },
      });
      logger.info(`New user registered: ${user.email} (${user.id})`);

      // Automatically provision a default Ethereal sender for immediate out-of-the-box scheduling
      try {
        const testAccount = await nodemailer.createTestAccount();
        await prisma.sender.create({
          data: {
            userId: user.id,
            email: testAccount.user,
            displayName: `${data.name} (Ethereal)`,
            smtpHost: testAccount.smtp.host,
            smtpPort: testAccount.smtp.port,
            smtpUser: testAccount.user,
            smtpPass: encrypt(testAccount.pass),
            isDefault: true,
          },
        });
        logger.info(`Auto-provisioned default Ethereal sender for ${user.email}`);
      } catch (err) {
        logger.warn('Failed to auto-provision initial Ethereal test account:', err);
      }
    } else {
      // Update details if necessary
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: data.googleId,
          name: data.name,
          avatar: data.avatar || user.avatar,
        },
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    };
  }

  /**
   * Generates a session token for a specific user ID.
   */
  public static generateToken(user: AuthUser): string {
    return jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }
}
