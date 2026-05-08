import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../../.env' });
dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3100),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  APP_MASTER_KEY: z.string().min(16),
  SSH_CONNECT_TIMEOUT_MS: z.coerce.number().default(10000),
  SSH_IDLE_TIMEOUT_MS: z.coerce.number().default(1800000),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(200),
});

export const env = schema.parse(process.env);
