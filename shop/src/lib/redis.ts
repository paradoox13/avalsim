import Redis from 'ioredis';

/**
 * Redis اختیاری است: برای کش و rate limiting.
 * اگر REDIS_URL تنظیم نشده باشد، به‌صورت خودکار از حافظه‌ی محلی استفاده می‌شود
 * تا محیط توسعه و تست بدون زیرساخت اضافه کار کند.
 */
const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    client.on('error', (err) => {
      console.error('[redis] error:', err.message);
    });
    return client;
  } catch (error) {
    console.error('[redis] init failed:', error);
    return null;
  }
}

export const redis: Redis | null = globalForRedis.redis ?? createRedis();
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

/** آیا Redis در دسترس است؟ */
export function hasRedis(): boolean {
  return redis !== null && redis.status === 'ready';
}

export default redis;
