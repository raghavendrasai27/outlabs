import nodemailer, { Transporter } from 'nodemailer';
import { SenderService } from './sender.service';
import { logger } from '../utils/logger';

export interface SendMailParams {
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
}

export interface SendMailResult {
  messageId: string;
  etherealPreviewUrl: string | false;
  accepted: string[];
  rejected: string[];
  response: string;
}

export class EmailSenderService {
  private static transporters: Map<string, Transporter> = new Map();

  /**
   * Retrieves or builds a cached Nodemailer transporter for a sender account.
   */
  private static async getTransporter(senderId: string): Promise<Transporter> {
    if (this.transporters.has(senderId)) {
      return this.transporters.get(senderId)!;
    }

    const credentials = await SenderService.getSenderCredentials(senderId);

    const transporter = nodemailer.createTransport({
      host: credentials.smtpHost,
      port: credentials.smtpPort,
      secure: credentials.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: credentials.smtpUser,
        pass: credentials.smtpPass,
      },
      tls: {
        rejectUnauthorized: false, // For Ethereal test server compatibility
      },
    });

    this.transporters.set(senderId, transporter);
    return transporter;
  }

  /**
   * Clears cached transporter when credentials change.
   */
  public static clearTransporterCache(senderId: string): void {
    this.transporters.delete(senderId);
  }

  /**
   * Sends real email through Nodemailer / Ethereal SMTP.
   * Confirms acceptance and extracts preview URL.
   */
  public static async sendEmail(params: SendMailParams): Promise<SendMailResult> {
    const transporter = await this.getTransporter(params.senderId);
    const credentials = await SenderService.getSenderCredentials(params.senderId);

    const fromAddress = credentials.displayName
      ? `"${credentials.displayName}" <${credentials.email}>`
      : credentials.email;

    logger.info(`Dispatching email to ${params.recipientEmail} via sender ${credentials.email}...`);

    const info = await transporter.sendMail({
      from: fromAddress,
      to: params.recipientEmail,
      subject: params.subject,
      text: params.body,
      html: params.body.replace(/\n/g, '<br/>'),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    if (previewUrl) {
      logger.info(`Email sent successfully! Ethereal Preview URL: ${previewUrl}`);
    } else {
      logger.info(`Email accepted by SMTP: ${info.messageId}`);
    }

    return {
      messageId: info.messageId,
      etherealPreviewUrl: previewUrl,
      accepted: info.accepted.map(String),
      rejected: info.rejected.map(String),
      response: info.response,
    };
  }
}
