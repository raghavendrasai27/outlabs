import { prisma } from '../config/db';
import nodemailer from 'nodemailer';
import { encrypt, decrypt } from '../utils/encryption';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface CreateSenderInput {
  email: string;
  displayName: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  isDefault?: boolean;
}

export class SenderService {
  /**
   * Retrieves all senders for a given user.
   */
  public static async getSendersForUser(userId: string) {
    const senders = await prisma.sender.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return senders.map((s) => ({
      id: s.id,
      email: s.email,
      displayName: s.displayName,
      smtpHost: s.smtpHost,
      smtpPort: s.smtpPort,
      smtpUser: s.smtpUser,
      isDefault: s.isDefault,
      createdAt: s.createdAt,
    }));
  }

  /**
   * Creates a new sender account.
   */
  public static async createSender(userId: string, input: CreateSenderInput) {
    if (input.isDefault) {
      await prisma.sender.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const sender = await prisma.sender.create({
      data: {
        userId,
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        smtpHost: input.smtpHost || 'smtp.ethereal.email',
        smtpPort: input.smtpPort || 587,
        smtpUser: input.smtpUser || input.email,
        smtpPass: encrypt(input.smtpPass || ''),
        isDefault: input.isDefault ?? false,
      },
    });

    return {
      id: sender.id,
      email: sender.email,
      displayName: sender.displayName,
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      isDefault: sender.isDefault,
      createdAt: sender.createdAt,
    };
  }

  /**
   * Auto-generates a real Ethereal SMTP test sender for the user.
   */
  public static async createEtherealSender(userId: string, displayName?: string) {
    logger.info(`Creating new Ethereal test account for user ${userId}...`);
    const testAccount = await nodemailer.createTestAccount();

    const existingCount = await prisma.sender.count({ where: { userId } });
    const isDefault = existingCount === 0;

    const sender = await prisma.sender.create({
      data: {
        userId,
        email: testAccount.user,
        displayName: displayName || `Ethereal Account (${testAccount.user.split('@')[0]})`,
        smtpHost: testAccount.smtp.host,
        smtpPort: testAccount.smtp.port,
        smtpUser: testAccount.user,
        smtpPass: encrypt(testAccount.pass),
        isDefault,
      },
    });

    return {
      id: sender.id,
      email: sender.email,
      displayName: sender.displayName,
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      smtpUser: sender.smtpUser,
      isDefault: sender.isDefault,
      createdAt: sender.createdAt,
    };
  }

  /**
   * Updates an existing sender.
   */
  public static async updateSender(
    userId: string,
    senderId: string,
    data: { displayName?: string; isDefault?: boolean }
  ) {
    const sender = await prisma.sender.findFirst({
      where: { id: senderId, userId },
    });

    if (!sender) {
      throw new AppError('Sender not found or unauthorized', 404);
    }

    if (data.isDefault) {
      await prisma.sender.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.sender.update({
      where: { id: senderId },
      data: {
        displayName: data.displayName !== undefined ? data.displayName.trim() : undefined,
        isDefault: data.isDefault !== undefined ? data.isDefault : undefined,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      isDefault: updated.isDefault,
    };
  }

  /**
   * Deletes a sender.
   */
  public static async deleteSender(userId: string, senderId: string) {
    const sender = await prisma.sender.findFirst({
      where: { id: senderId, userId },
    });

    if (!sender) {
      throw new AppError('Sender not found or unauthorized', 404);
    }

    const activeScheduled = await prisma.scheduledEmail.count({
      where: {
        senderId,
        status: { in: ['scheduled', 'processing'] },
      },
    });

    if (activeScheduled > 0) {
      throw new AppError(
        `Cannot delete sender with ${activeScheduled} scheduled or active emails pending.`,
        400
      );
    }

    await prisma.sender.delete({ where: { id: senderId } });
    return { success: true };
  }

  /**
   * Internal helper: retrieves full credentials with decrypted password for SMTP transport.
   */
  public static async getSenderCredentials(senderId: string) {
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });

    if (!sender) {
      throw new AppError(`Sender account ${senderId} not found`, 404);
    }

    return {
      ...sender,
      smtpPass: decrypt(sender.smtpPass),
    };
  }
}
