import { describe, expect, it } from 'vitest';
import {
  basisPointsOf,
  formatToman,
  formatTomanCompact,
  mulToman,
  sumToman,
  taxOf,
  toToman,
} from '@/lib/utils/money';

describe('محاسبات مالی (تومان)', () => {
  it('ورودی‌های مختلف را به BigInt تبدیل می‌کند', () => {
    expect(toToman('۲٫۵۰۰٫۰۰۰')).toBe(2500000n);
    expect(toToman(2500000)).toBe(2500000n);
    expect(toToman(2500000n)).toBe(2500000n);
  });

  it('مبالغ نامعتبر را رد می‌کند', () => {
    expect(() => toToman('abc')).toThrow();
    expect(() => toToman(-5)).toThrow();
  });

  it('ضرب و جمع بدون خطای اعشاری انجام می‌شود', () => {
    expect(mulToman(1_999_999n, 3)).toBe(5_999_997n);
    expect(sumToman([100n, 200n, 300n])).toBe(600n);
  });

  it('درصد بر مبنای basis point با گردکردن نیم‌به‌بالا', () => {
    expect(basisPointsOf(1000000n, 500)).toBe(50000n); // ۵٪
    expect(basisPointsOf(100n, 5)).toBe(0n); // ۰٫۰۵٪ از ۱۰۰ = ۰٫۰۵ → ۰
    expect(basisPointsOf(100n, 50)).toBe(1n); // ۰٫۵٪ از ۱۰۰ = ۰٫۵ → ۱
    expect(taxOf(1000000n, 900)).toBe(90000n); // ۹٪ مالیات
  });

  it('نمایش مبلغ با ارقام و جداکننده فارسی', () => {
    expect(formatToman(2500000n)).toBe('۲٫۵۰۰٫۰۰۰ تومان');
    expect(formatToman(2500000n, false)).toBe('۲٫۵۰۰٫۰۰۰');
  });

  it('نمایش خلاصه مبلغ', () => {
    expect(formatTomanCompact(2500000n)).toContain('میلیون');
    expect(formatTomanCompact(1_200_000_000n)).toContain('میلیارد');
    expect(formatTomanCompact(500n)).toContain('تومان');
  });
});
