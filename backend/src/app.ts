import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import senderRoutes from './routes/sender.routes';
import emailRoutes from './routes/email.routes';
import campaignRoutes from './routes/campaign.routes';
import slackRoutes from './routes/slack.routes';
import { bullBoardRouter } from './config/bullBoard';
import { redisClient } from './config/redis';
import { prisma } from './config/db';
import { QueueService } from './queues/email.queue';

const app: Application = express();

// Security and utility middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows bull-board UI scripts & assets
  })
);

app.use(
  cors({
    origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// System Health Check Endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  let dbOk = false;
  let redisOk = false;
  let queueMetrics = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  try {
    const ping = await redisClient.ping();
    redisOk = ping === 'PONG';
    queueMetrics = await QueueService.getQueueMetrics();
  } catch {
    redisOk = false;
  }

  res.json({
    status: dbOk && redisOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: dbOk ? 'connected' : 'disconnected',
      redis: redisOk ? 'connected' : 'disconnected',
      bullQueue: queueMetrics,
    },
  });
});

// Admin Queue Dashboard (Bull-Board)
app.use('/admin/queues', bullBoardRouter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/slack', slackRoutes);

// Centralized error handling
app.use(errorHandler);

export default app;
