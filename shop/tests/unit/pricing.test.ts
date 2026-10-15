import { describe, expect, it } from 'vitest';
import { computeTierTotal, formatTierRange, pickTier, type ActivationTier } from '@/lib/utils/pricing';

const tiers: ActivationTier[] = [
  { minQty: 1, maxQty: 9, unitPrice: 2_500_000n },
  { minQty: 10, maxQty: 49, unitPrice: 2_300_000n },
  { minQty: 50, maxQty: null, unitPrice: 2_100_000n },
];

describe('قیمت‌گذاری پله‌ای کد فعال‌سازی', () => {
  it('پله‌ی درست را برای هر تعداد انتخاب می‌کند', () => {
    expect(pickTier(tiers, 1)?.unitPrice).toBe(2_500_000n);
    expect(pickTier(tiers, 9)?.unitPrice).toBe(2_500_000n);
    expect(pickTier(tiers, 10)?.unitPrice).toBe(2_300_000n);
    expect(pickTier(tiers, 49)?.unitPrice).toBe(2_300_000n);
    expect(pickTier(tiers, 50)?.unitPrice).toBe(2_100_000n);
    expect(pickTier(tiers, 500)?.unitPrice).toBe(2_100_000n);
  });

  it('برای تعداد نامعتبر null برمی‌گرداند', () => {
    expect(pickTier(tiers, 0)).toBeNull();
    expect(pickTier([], 5)).toBeNull();
  });

  it('مبلغ کل را درست محاسبه می‌کند', () => {
    expect(computeTierTotal(tiers, 10)).toBe(23_000_000n);
    expect(computeTierTotal(tiers, 50)).toBe(105_000_000n);
  });

  it('اگر تعدادی زیر کمترین پله باشد، پله‌ای انتخاب نمی‌شود', () => {
    const highTiers: ActivationTier[] = [{ minQty: 100, maxQty: null, unitPrice: 1000n }];
    expect(pickTier(highTiers, 5)).toBeNull();
  });

  it('نمایش بازه‌ی پله', () => {
    expect(formatTierRange({ minQty: 1, maxQty: 9 })).toContain('۱ تا ۹');
    expect(formatTierRange({ minQty: 50, maxQty: null })).toContain('به بالا');
  });
});
