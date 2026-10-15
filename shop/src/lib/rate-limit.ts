import { redis, hasRedis } from './redis';

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, MemoryBucket>();

/** پاک‌سازی دوره‌ای حافظه برای جلوگیری از رشد بی‌رویه */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * محدودیت نرخ به‌صورت پنجره‌ی ثابت (fixed window).
 * درخواست‌های حساس مثل ورود، پرداخت و پیامک باید محدود شوند.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const bucketKey = `rl:${key}`;

  if (redis && hasRedis()) {
    try {
      const current = await redis.incr(bucketKey);
      if (current === 1) await redis.pexpire(bucketKey, windowMs);
      const ttl = await redis.pttl(bucketKey);
      const resetAt = now + (ttl > 0 ? ttl : windowMs);
      return {
        ok: current <= limit,
        limit,
        remaining: Math.max(0, limit - current),
        resetAt,
      };
    } catch {
      /* در صورت خطای Redis به حافظه برمی‌گردیم */
    }
  }

  sweep(now);
  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(bucketKey, bucket);
    return { ok: true, limit, remaining: limit - 1, resetAt: bucket.resetAt };
  }
  existing.count += 1;
  return {
    ok: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export function resetRateLimit(key: string): void {
  buckets.delete(`rl:${key}`);
}

/** پیکربندی محدودیت‌های سخت‌گیرانه‌ی مسیرهای حساس */
export const RATE_LIMITS = {
  login: { limit: 8, window: 300 },
  register: { limit: 5, window: 3600 },
  otp: { limit: 5, window: 300 },
  checkout: { limit: 10, window: 300 },
  paymentCallback: { limit: 30, window: 300 },
  search: { limit: 120, window: 60 },
  excelImport: { limit: 5, window: 3600 },
  contact: { limit: 3, window: 3600 },
  api: { limit: 300, window: 60 },
} as const;
