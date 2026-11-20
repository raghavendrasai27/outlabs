import { Request } from 'express';

export type UserRole = 'USER' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface EmailJobData {
  scheduledEmailId: string;
  campaignId: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string; // ISO string
  idempotencyKey: string;
  attempt?: number;
}

export interface SchedulingResult {
  campaignId: string;
  totalRecipients: number;
  scheduledCount: number;
  invalidCount: number;
  estimatedCompletionTime: Date;
  hourlyLimitApplied: number;
}

export interface SlackAlertPayload {
  senderEmail: string;
  senderName: string;
  hourlyLimit: number;
  hourWindow: string;
  delayedCount: number;
  nextWindowTime: Date;
}

export interface ElasticsearchEmailDoc {
  id: string;
  campaignId: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: 'scheduled' | 'processing' | 'sent' | 'failed';
  scheduledAt: string;
  sentAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}
