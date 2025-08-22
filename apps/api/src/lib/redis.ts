import Redis from 'ioredis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis reconnecting...');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down Redis connection...');
  await redis.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down Redis connection...');
  await redis.quit();
  process.exit(0);
});
