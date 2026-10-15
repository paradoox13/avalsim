import { describe, expect, it } from 'vitest';
import {
  formatJalaliDate,
  formatJalaliDateTime,
  formatJalaliLong,
  jalaliPeriodKey,
  jalaliToDate,
  toJalali,
} from '@/lib/utils/jalali';

describe('تبدیل و نمایش تاریخ شمسی', () => {
  it('تاریخ میلادی را به شمسی تبدیل می‌کند', () => {
    // ۲۰۲۴-۰۳-۲۰ برابر با ۱ فروردین ۱۴۰۳ است
    const parts = toJalali(new Date(2024, 2, 20));
    expect(parts.jy).toBe(1403);
    expect(parts.jm).toBe(1);
    expect(parts.jd).toBe(1);
  });

  it('رفت و برگشت شمسی → میلادی درست است', () => {
    const date = jalaliToDate(1403, 8, 12);
    const back = toJalali(date);
    expect(back).toEqual({ jy: 1403, jm: 8, jd: 12 });
  });

  it('نمایش تاریخ با ارقام فارسی', () => {
    expect(formatJalaliDate(new Date(2024, 2, 20))).toBe('۱۴۰۳/۰۱/۰۱');
    expect(formatJalaliDate(new Date(2024, 2, 20), false)).toBe('1403/01/01');
  });

  it('نمایش تاریخ و ساعت', () => {
    const text = formatJalaliDateTime(new Date(2024, 2, 20, 14, 30));
    expect(text).toContain('۱۴:۳۰');
  });

  it('نمایش بلند تاریخ با نام ماه', () => {
    expect(formatJalaliLong(new Date(2024, 2, 20))).toContain('فروردین');
  });

  it('کلید دوره برای شماره‌گذاری سفارش', () => {
    expect(jalaliPeriodKey(new Date(2024, 2, 20))).toBe('140301');
  });
});
