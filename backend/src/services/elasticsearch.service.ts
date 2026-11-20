import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ElasticsearchEmailDoc } from '../types';
import { prisma } from '../config/db';

export const EMAIL_INDEX_NAME = 'reachinbox_emails';

export class ElasticsearchService {
  private static client: Client | null = null;
  private static isAvailable = false;

  public static getClient(): Client {
    if (!this.client) {
      this.client = new Client({
        node: env.ELASTICSEARCH_NODE,
        tls: { rejectUnauthorized: false },
      });
    }
    return this.client;
  }

  /**
   * Initializes the Elasticsearch index with proper mappings if not already existing.
   */
  public static async initIndex(): Promise<void> {
    const client = this.getClient();
    try {
      const exists = await client.indices.exists({ index: EMAIL_INDEX_NAME });
      if (!exists) {
        await client.indices.create({
          index: EMAIL_INDEX_NAME,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  email_analyzer: {
                    type: 'custom',
                    tokenizer: 'uax_url_email',
                  },
                },
              },
            },
            mappings: {
              properties: {
                id: { type: 'keyword' },
                campaignId: { type: 'keyword' },
                userId: { type: 'keyword' },
                senderId: { type: 'keyword' },
                senderEmail: { type: 'text', analyzer: 'email_analyzer' },
                recipientEmail: { type: 'text', analyzer: 'email_analyzer' },
                subject: { type: 'text' },
                body: { type: 'text' },
                status: { type: 'keyword' },
                scheduledAt: { type: 'date' },
                sentAt: { type: 'date' },
                errorMessage: { type: 'text' },
                createdAt: { type: 'date' },
              },
            },
          },
        });
        logger.info(`Elasticsearch index '${EMAIL_INDEX_NAME}' created successfully.`);
      }
      this.isAvailable = true;
    } catch (err: any) {
      logger.warn('Elasticsearch is currently unreachable. Search will gracefully fallback to PostgreSQL.', {
        error: err.message,
      });
      this.isAvailable = false;
    }
  }

  /**
   * Indexes or updates an email document.
   */
  public static async indexEmail(doc: ElasticsearchEmailDoc): Promise<void> {
    try {
      const client = this.getClient();
      await client.index({
        index: EMAIL_INDEX_NAME,
        id: doc.id,
        document: doc,
        refresh: 'wait_for',
      });
    } catch (err: any) {
      logger.warn(`Failed to index email ${doc.id} into Elasticsearch (non-fatal):`, err.message);
    }
  }

  /**
   * Updates status, sentAt, or errorMessage of an existing email document.
   */
  public static async updateEmailStatus(
    id: string,
    update: {
      status: string;
      sentAt?: string | null;
      errorMessage?: string | null;
    }
  ): Promise<void> {
    try {
      const client = this.getClient();
      await client.update({
        index: EMAIL_INDEX_NAME,
        id,
        doc: update,
        refresh: 'wait_for',
      });
    } catch (err: any) {
      logger.warn(`Failed to update email status in Elasticsearch for ${id} (non-fatal):`, err.message);
    }
  }

  /**
   * Executes a full-text search across recipientEmail, subject, body, sender, status.
   * If Elasticsearch is down, safely falls back to PostgreSQL ILIKE search.
   */
  public static async searchEmails(params: {
    userId: string;
    query?: string;
    status?: string;
    senderId?: string;
    campaignId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: any[]; total: number; page: number; limit: number; source: 'elasticsearch' | 'database' }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const from = (page - 1) * limit;

    // Try Elasticsearch first if available
    try {
      const client = this.getClient();
      const mustClauses: any[] = [{ term: { userId: params.userId } }];

      if (params.status) {
        mustClauses.push({ term: { status: params.status } });
      }
      if (params.senderId) {
        mustClauses.push({ term: { senderId: params.senderId } });
      }
      if (params.campaignId) {
        mustClauses.push({ term: { campaignId: params.campaignId } });
      }

      if (params.query && params.query.trim()) {
        mustClauses.push({
          multi_match: {
            query: params.query.trim(),
            fields: ['subject^3', 'recipientEmail^2', 'body', 'senderEmail'],
            fuzziness: 'AUTO',
          },
        });
      }

      const esResponse = await client.search({
        index: EMAIL_INDEX_NAME,
        from,
        size: limit,
        sort: [{ scheduledAt: { order: 'desc' } }],
        query: {
          bool: {
            must: mustClauses,
          },
        },
      });

      const totalHits = typeof esResponse.hits.total === 'number' 
        ? esResponse.hits.total 
        : esResponse.hits.total?.value || 0;

      const items = esResponse.hits.hits.map((h: any) => h._source);

      return {
        items,
        total: totalHits,
        page,
        limit,
        source: 'elasticsearch',
      };
    } catch (err: any) {
      logger.warn('Elasticsearch query failed or offline, falling back to PostgreSQL database search:', err.message);
    }

    // Fallback: PostgreSQL query
    const where: any = { userId: params.userId };

    if (params.status) {
      where.status = params.status;
    }
    if (params.senderId) {
      where.senderId = params.senderId;
    }
    if (params.campaignId) {
      where.campaignId = params.campaignId;
    }
    if (params.query && params.query.trim()) {
      const q = params.query.trim();
      where.OR = [
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      prisma.scheduledEmail.count({ where }),
      prisma.scheduledEmail.findMany({
        where,
        include: {
          sender: { select: { email: true, displayName: true } },
          campaign: { select: { subject: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        skip: from,
        take: limit,
      }),
    ]);

    const formatted = records.map((r) => ({
      id: r.id,
      campaignId: r.campaignId,
      userId: r.userId,
      senderId: r.senderId,
      senderEmail: r.sender.email,
      senderName: r.sender.displayName,
      recipientEmail: r.recipientEmail,
      subject: r.subject,
      body: r.body,
      status: r.status,
      scheduledAt: r.scheduledAt.toISOString(),
      sentAt: r.sentAt?.toISOString() || null,
      etherealPreviewUrl: r.etherealPreviewUrl,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items: formatted,
      total,
      page,
      limit,
      source: 'database',
    };
  }

  /**
   * Synchronizes all emails from PostgreSQL to Elasticsearch (bulk reindex).
   */
  public static async syncFromPostgres(): Promise<{ indexedCount: number }> {
    const client = this.getClient();
    await this.initIndex();

    const emails = await prisma.scheduledEmail.findMany({
      include: { sender: true },
    });

    if (emails.length === 0) return { indexedCount: 0 };

    const operations = emails.flatMap((doc) => [
      { index: { _index: EMAIL_INDEX_NAME, _id: doc.id } },
      {
        id: doc.id,
        campaignId: doc.campaignId,
        userId: doc.userId,
        senderId: doc.senderId,
        senderEmail: doc.sender.email,
        recipientEmail: doc.recipientEmail,
        subject: doc.subject,
        body: doc.body,
        status: doc.status,
        scheduledAt: doc.scheduledAt.toISOString(),
        sentAt: doc.sentAt?.toISOString() || null,
        errorMessage: doc.errorMessage,
        createdAt: doc.createdAt.toISOString(),
      },
    ]);

    const bulkResponse = await client.bulk({ refresh: true, operations });
    if (bulkResponse.errors) {
      logger.warn('Some errors occurred during Elasticsearch bulk sync');
    }

    logger.info(`Synchronized ${emails.length} emails from PostgreSQL into Elasticsearch.`);
    return { indexedCount: emails.length };
  }
}
