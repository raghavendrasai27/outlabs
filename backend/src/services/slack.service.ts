import { WebClient } from '@slack/web-api';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { encrypt, decrypt } from '../utils/encryption';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { SlackAlertPayload } from '../types';

export class SlackService {
  /**
   * Generates the Slack OAuth 2.0 authorization URL.
   */
  public static getAuthorizationUrl(userId: string): string {
    const scopes = ['chat:write', 'channels:read', 'groups:read', 'incoming-webhook'].join(',');
    const redirectUri = encodeURIComponent(env.SLACK_REDIRECT_URI);
    const state = encodeURIComponent(userId);

    return `https://slack.com/oauth/v2/authorize?client_id=${env.SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
  }

  /**
   * Handles Slack OAuth 2.0 callback and saves encrypted access token.
   */
  public static async handleOAuthCallback(code: string, userId: string) {
    const client = new WebClient();

    try {
      const response = await client.oauth.v2.access({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: env.SLACK_REDIRECT_URI,
      });

      if (!response.ok || !response.access_token) {
        throw new Error(response.error || 'Slack OAuth token exchange failed');
      }

      const teamId = response.team?.id || '';
      const teamName = response.team?.name || 'Slack Workspace';
      const channelId = response.incoming_webhook?.channel_id || null;

      const encryptedToken = encrypt(response.access_token);

      const integration = await prisma.slackIntegration.upsert({
        where: { userId },
        create: {
          userId,
          accessToken: encryptedToken,
          teamId,
          teamName,
          channelId,
          connected: true,
        },
        update: {
          accessToken: encryptedToken,
          teamId,
          teamName,
          channelId,
          connected: true,
        },
      });

      logger.info(`Slack successfully connected for user ${userId} (Team: ${teamName})`);
      return integration;
    } catch (err: any) {
      logger.error('Error exchanging Slack OAuth code:', err);
      throw err;
    }
  }

  /**
   * Retrieves Slack connection status for a user.
   */
  public static async getConnectionStatus(userId: string) {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.connected) {
      return { connected: false };
    }

    return {
      connected: true,
      teamId: integration.teamId,
      teamName: integration.teamName,
      createdAt: integration.createdAt,
    };
  }

  /**
   * Disconnects Slack integration for a user.
   */
  public static async disconnectSlack(userId: string) {
    await prisma.slackIntegration.updateMany({
      where: { userId },
      data: { connected: false },
    });
    return { success: true };
  }

  /**
   * Sends rate limit alert to user's Slack workspace if connected.
   * Utilizes Redis-backed deduplication to ensure exactly one alert per sender/window.
   */
  public static async sendRateLimitAlert(
    userId: string,
    senderId: string,
    payload: SlackAlertPayload
  ): Promise<boolean> {
    try {
      // Deduplication key in Redis for 1 hour
      const dedupKey = `reachinbox:slack_dedup:${senderId}:${payload.hourWindow}`;
      const acquired = await redisClient.set(dedupKey, '1', 'EX', 3600, 'NX');

      if (!acquired) {
        logger.info(`Slack alert already dispatched for sender ${senderId} in window ${payload.hourWindow}. Suppressing duplicate.`);
        return false;
      }

      const integration = await prisma.slackIntegration.findUnique({
        where: { userId },
      });

      if (!integration || !integration.connected || !integration.accessToken) {
        logger.debug(`User ${userId} does not have an active Slack integration. Skipping notification.`);
        return false;
      }

      const rawToken = decrypt(integration.accessToken);
      const client = new WebClient(rawToken);

      // Format blocks for rich Slack message
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ ReachInbox Hourly Email Rate Limit Reached',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n${payload.senderName} (${payload.senderEmail})`,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Quota:*\n${payload.hourlyLimit} emails/hour`,
            },
            {
              type: 'mrkdwn',
              text: `*Current Window:*\n${payload.hourWindow}`,
            },
            {
              type: 'mrkdwn',
              text: `*Rescheduled Emails:*\n${payload.delayedCount} delayed to next window`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Next Sending Window:* <!date^${Math.floor(
              payload.nextWindowTime.getTime() / 1000
            )}^{date_num} {time_secs}|${payload.nextWindowTime.toUTCString()}>\n_Subsequent emails have been automatically postponed in the persistent queue without data loss._`,
          },
        },
      ];

      // Send to channel or general
      const targetChannel = integration.channelId || 'general';

      await client.chat.postMessage({
        channel: targetChannel,
        text: `⚠️ Rate limit reached for ${payload.senderEmail}. Remaining emails postponed to next window.`,
        blocks,
      });

      logger.info(`Slack rate limit notification successfully dispatched to team ${integration.teamName}`);
      return true;
    } catch (err: any) {
      logger.error('Failed to dispatch Slack rate limit notification (non-fatal):', err.message);
      return false;
    }
  }
}
