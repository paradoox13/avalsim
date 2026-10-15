/**
 * منطق قیمت‌گذاری کد فعال‌سازی — ماژول خالص و قابل تست
 * (هم در سرور و هم در فرانت‌اند قابل استفاده است)
 */
import { toPersianDigits } from './persian';

export interface ActivationTier {
  minQty: number;
  maxQty: number | null;
  unitPrice: bigint;
}

/**
 * انتخاب پله‌ی قیمت مناسب بر اساس تعداد.
 * اگر تعدادی در بازه‌ی هیچ پله‌ای نباشد، آخرین پله‌ی شروع‌شده انتخاب می‌شود.
 */
export function pickTier(tiers: ActivationTier[], quantity: number): ActivationTier | null {
  if (!tiers.length || quantity <= 0) return null;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
  const inRange = sorted.find(
    (t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty),
  );
  if (inRange) return inRange;
  const candidates = sorted.filter((t) => t.minQty <= quantity);
  return candidates.length ? candidates[candidates.length - 1] : null;
}

/** محاسبه‌ی مبلغ کل بر اساس پله‌ی قیمت */
export function computeTierTotal(tiers: ActivationTier[], quantity: number): bigint {
  const tier = pickTier(tiers, quantity);
  if (!tier) return 0n;
  return tier.unitPrice * BigInt(quantity);
}

/** نمایش بازه‌ی تعداد با ارقام فارسی */
export function formatTierRange(tier: { minQty: number; maxQty: number | null }): string {
  if (tier.maxQty === null) return `از ${toPersianDigits(tier.minQty)} به بالا`;
  if (tier.minQty === tier.maxQty) return `${toPersianDigits(tier.minQty)} عدد`;
  return `${toPersianDigits(tier.minQty)} تا ${toPersianDigits(tier.maxQty)} عدد`;
}
