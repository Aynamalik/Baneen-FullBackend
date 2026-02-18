import Redis from 'ioredis';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

let redisClient = null;

/**
 * Get Redis client. Returns null if REDIS_URL is not configured.
 */
export const getRedisClient = () => {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    redisClient.on('error', (err) => logger.error('Redis error:', err));
    redisClient.on('connect', () => logger.info('Redis connected'));
    return redisClient;
  } catch (err) {
    logger.error('Redis connection failed:', err);
    return null;
  }
};

/**
 * Check if Redis is available and connected.
 */
export const isRedisAvailable = () => {
  const client = getRedisClient();
  return client && client.status === 'ready';
};

/**
 * Gracefully close Redis connection.
 */
export const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

export default { getRedisClient, isRedisAvailable, closeRedis };
