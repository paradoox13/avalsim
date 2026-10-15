import { redis, hasRedis } from './redis';

interface Entry {
  value: unknown;
  expiresAt: number;
}

const memory = new Map<string, Entry>();

/**
 * کش ساده با پشتوانه‌ی Redis و fallback حافظه‌ای.
 * برای داده‌های پرتکرار مثل لیست اپراتورها و تنظیمات سایت.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      /* در صورت خطا به حافظه برمی‌گردیم */
    }
  }
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  if (redis && hasRedis()) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    } catch {
      /* ignore */
    }
  }
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDel(prefix: string): Promise<void> {
  if (redis) {
    try {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length) await redis.del(...keys);
    } catch {
      /* ignore */
    }
  }
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await loader();
  await cacheSet(key, value, ttlSeconds);
  return value;
}
