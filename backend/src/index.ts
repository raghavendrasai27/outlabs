import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { connectRedis, disconnectRedis } from './config/redis';
import { RecoveryService } from './services/recovery.service';
import { EmailWorkerManager } from './workers/email.worker';
import { ElasticsearchService } from './services/elasticsearch.service';
import { logger } from './utils/logger';

async function bootstrap() {
  logger.info('=====================================================');
  logger.info('  Starting ReachInbox Email Job Scheduler Server...  ');
  logger.info('=====================================================');

  // 1. Connect to PostgreSQL
  try {
    await connectDatabase();
  } catch (err: any) {
    logger.warn('Initial PostgreSQL connection attempt warning:', err.message);
  }

  // 2. Connect to Redis
  try {
    await connectRedis();
  } catch (err: any) {
    logger.warn('Initial Redis connection attempt warning:', err.message);
  }

  // 3. Persistent Queue Restart Recovery & Job Reconciliation
  try {
    await RecoveryService.reconcileJobs();
  } catch (err: any) {
    logger.warn('Restart recovery warning (non-fatal):', err.message);
  }

  // 4. Initialize Elasticsearch
  try {
    await ElasticsearchService.initIndex();
  } catch (err: any) {
    logger.warn('Elasticsearch initialization warning (non-fatal):', err.message);
  }

  // 5. Start BullMQ Persistent Worker
  try {
    EmailWorkerManager.startWorker();
  } catch (err: any) {
    logger.warn('BullMQ Worker initialization warning:', err.message);
  }

  // 6. Start HTTP Server
  const server = app.listen(env.PORT, () => {
    logger.info(`ReachInbox API server running on http://localhost:${env.PORT}`);
    logger.info(`BullMQ Admin Dashboard available at http://localhost:${env.PORT}/admin/queues`);
    logger.info(`Health check available at http://localhost:${env.PORT}/api/health`);
  });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await EmailWorkerManager.stopWorker();
        await disconnectRedis();
        await disconnectDatabase();
        logger.info('All database connections and queues closed safely. Exiting.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown:', err);
        process.exit(1);
      }
    });

    // Force exit if hanging longer than 10 seconds
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal error during application startup:', err);
  process.exit(1);
});
