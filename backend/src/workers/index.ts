import { connectDatabase, disconnectDatabase } from '../config/db';
import { connectRedis, disconnectRedis } from '../config/redis';
import { EmailWorkerManager } from './email.worker';
import { RecoveryService } from '../services/recovery.service';
import { ElasticsearchService } from '../services/elasticsearch.service';
import { logger } from '../utils/logger';

async function startStandaloneWorker() {
  logger.info('Starting ReachInbox Standalone Worker Process...');

  await connectDatabase();
  await connectRedis();

  // Run startup reconciliation
  try {
    await RecoveryService.reconcileJobs();
  } catch (err: any) {
    logger.warn('Reconciliation encountered warning:', err.message);
  }

  // Init Elasticsearch
  try {
    await ElasticsearchService.initIndex();
  } catch (err: any) {
    logger.warn('Elasticsearch initialization warning:', err.message);
  }

  // Start BullMQ Worker
  EmailWorkerManager.startWorker();

  const shutdown = async () => {
    logger.info('Received shutdown signal, terminating worker...');
    await EmailWorkerManager.stopWorker();
    await disconnectRedis();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  startStandaloneWorker().catch((err) => {
    logger.error('Worker failed to start:', err);
    process.exit(1);
  });
}
