import { describe, expect, it } from 'vitest';
import { analyzeNumber, patternToLike, isValidPattern } from '@/lib/utils/pattern';

describe('تحلیل زیبایی شماره', () => {
  it('شماره با چهار رقم آخر یکسان را رند تشخیص می‌دهد', () => {
    const result = analyzeNumber('09121111111');
    expect(result.isRond).toBe(true);
    // «۰۹۱۲۱۱۱۱۱۱۱» هفت رقم ۱ متوالی در انتها دارد
    expect(result.maxRepeat).toBe(7);
    expect(result.tags.length).toBeGreaterThan(0);
  });

  it('شماره‌ی دارای دنباله‌ی متوالی را می‌شناسد', () => {
    const result = analyzeNumber('09121234567');
    expect(result.isSequential).toBe(true);
    expect(result.longestSequence).toBeGreaterThanOrEqual(4);
  });

  it('شماره‌ی معمولی را رند نمی‌داند', () => {
    const result = analyzeNumber('09127894512');
    expect(result.isRond).toBe(false);
  });

  it('پالیندروم را تشخیص می‌دهد', () => {
    const result = analyzeNumber('0912345654321'.slice(0, 11));
    expect(result.isPalindrome).toBe(true);
  });

  it('امتیاز رند در بازه ۰ تا ۱۰۰ است', () => {
    for (const number of ['09121111111', '09121234567', '09127894512', '09351234567']) {
      const score = analyzeNumber(number).rondScore;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('بلوک تکرارشونده در انتها را می‌شناسد', () => {
    expect(analyzeNumber('09123434343').isRepeated).toBe(true);
  });
});

describe('تبدیل الگوی عددی به LIKE', () => {
  it('کاراکتر ? را به وایل‌کارد تک‌رقمی تبدیل می‌کند', () => {
    expect(patternToLike('0912???1111')).toBe('%0912___1111%');
  });

  it('کاراکتر * را به وایل‌کارد چندرقمی تبدیل می‌کند', () => {
    expect(patternToLike('0912*1111')).toBe('%0912%1111%');
  });

  it('کاراکترهای ویژه SQL را بی‌خطر می‌کند', () => {
    expect(patternToLike('0912%')).toBe('%0912\\%%');
    expect(patternToLike('0912_')).toBe('%0912\\_%');
  });

  it('ارقام فارسی را نرمال می‌کند', () => {
    expect(patternToLike('۰۹۱۲?')).toBe('%0912_%');
  });

  it('اعتبارسنجی الگو', () => {
    expect(isValidPattern('0912*')).toBe(true);
    expect(isValidPattern('abc')).toBe(false);
  });
});
