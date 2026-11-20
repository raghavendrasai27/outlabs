import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  BACKEND_URL: z.string().default('http://localhost:5000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_HOST: z.string().default(process.env.REDISHOST || 'localhost'),
  REDIS_PORT: z.coerce.number().default(process.env.REDISPORT ? Number(process.env.REDISPORT) : 6379),
  REDIS_PASSWORD: z.string().optional().default(process.env.REDISPASSWORD || ''),

  ELASTICSEARCH_NODE: z.string().default('http://localhost:9200'),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/api/auth/google/callback'),

  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/api/slack/callback'),

  JWT_SECRET: z.string().default('super_secret_jwt_key_at_least_32_chars_long!'),
  SESSION_SECRET: z.string().default('super_secret_session_reachinbox_scheduler_2026!'),
  ENCRYPTION_KEY: z.string().default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),

  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.coerce.number().default(587),
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASS: z.string().optional().default(''),

  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(200),
});

export const env = envSchema.parse(process.env);
