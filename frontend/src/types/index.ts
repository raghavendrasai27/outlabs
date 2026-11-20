export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface Sender {
  id: string;
  email: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ScheduledEmail {
  id: string;
  campaignId: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'scheduled' | 'processing' | 'sent' | 'failed';
  bullJobId?: string | null;
  errorMessage?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: string;
    email: string;
    displayName: string;
  };
  campaign?: {
    id: string;
    subject: string;
  };
}

export interface Campaign {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  status: string;
  createdAt: string;
  _count?: {
    scheduledEmails: number;
  };
}

export interface DashboardStats {
  totalEmails: number;
  scheduledEmails: number;
  sentEmails: number;
  failedEmails: number;
  remainingInHour: number;
  hourWindow: string;
  queueMetrics?: {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    total: number;
  };
}

export interface SlackStatus {
  connected: boolean;
  teamId?: string;
  teamName?: string;
  createdAt?: string;
}

export interface SchedulingResponse {
  campaignId: string;
  totalRecipients: number;
  scheduledCount: number;
  invalidCount: number;
  estimatedCompletionTime: string;
  hourlyLimitApplied: number;
}
