import { describe, expect, it } from 'vitest';
import {
  buildPrefixMap,
  detectOperatorCode,
  extractPrefix,
  extractSuffix,
  isValidIranianMobile,
  normalizeMsisdn,
  OPERATOR_SEED,
} from '@/lib/filters/operator-detect';

describe('نرمال‌سازی شماره موبایل', () => {
  it('فرمت‌های مختلف را به شکل استاندارد تبدیل می‌کند', () => {
    expect(normalizeMsisdn('09121234567')).toBe('09121234567');
    expect(normalizeMsisdn('+989121234567')).toBe('09121234567');
    expect(normalizeMsisdn('00989121234567')).toBe('09121234567');
    expect(normalizeMsisdn('989121234567')).toBe('09121234567');
    expect(normalizeMsisdn('9121234567')).toBe('09121234567');
    expect(normalizeMsisdn('۰۹۱۲ ۳۴۵ ۶۷۸۹')).toBe('09123456789');
    expect(normalizeMsisdn('0912-345-6789')).toBe('09123456789');
  });

  it('شماره‌های نامعتبر را رد می‌کند', () => {
    expect(normalizeMsisdn('12345')).toBeNull();
    expect(normalizeMsisdn('0812345678')).toBeNull();
    expect(normalizeMsisdn('091212345678')).toBeNull();
    expect(normalizeMsisdn('')).toBeNull();
  });

  it('اعتبارسنجی شماره ایران درست کار می‌کند', () => {
    expect(isValidIranianMobile('09121234567')).toBe(true);
    expect(isValidIranianMobile('123')).toBe(false);
  });

  it('پیش‌شماره و پسوند را جدا می‌کند', () => {
    expect(extractPrefix('09121234567')).toBe('0912');
    expect(extractSuffix('09121234567')).toBe('4567');
  });
});

describe('تشخیص اپراتور از پیش‌شماره', () => {
  it('اپراتورهای اصلی را می‌شناسد', () => {
    expect(detectOperatorCode('09121234567')).toBe('MCI');
    expect(detectOperatorCode('09301234567')).toBe('IRANCELL');
    expect(detectOperatorCode('09201234567')).toBe('RIGHTEL');
    expect(detectOperatorCode('09981234567')).toBe('SHATEL');
  });

  it('برای پیش‌شماره ناشناخته OTHER برمی‌گرداند', () => {
    expect(detectOperatorCode('09961234567')).toBe('MCI'); // 0996 متعلق به همراه اول است
    expect(detectOperatorCode('0800123456')).toBe('OTHER');
  });

  it('نقشه‌ی پیش‌شماره بدون تکرار ساخته می‌شود', () => {
    const map = buildPrefixMap();
    const all = OPERATOR_SEED.flatMap((op) => op.prefixes);
    expect(new Set(all).size).toBe(all.length);
    expect(map.size).toBe(all.length);
  });
});
