import { describe, expect, it } from 'vitest';
import {
  formatPersianNumber,
  normalizePersianText,
  onlyDigits,
  toEnglishDigits,
  toPersianDigits,
} from '@/lib/utils/persian';

describe('ابزار ارقام فارسی', () => {
  it('ارقام لاتین را به فارسی تبدیل می‌کند', () => {
    expect(toPersianDigits('0912')).toBe('۰۹۱۲');
    expect(toPersianDigits(2024)).toBe('۲۰۲۴');
  });

  it('ارقام فارسی و عربی را به لاتین برمی‌گرداند', () => {
    expect(toEnglishDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(toEnglishDigits('٠١٢٣')).toBe('0123');
  });

  it('جداکننده‌ها و نیم‌فاصله را حذف می‌کند', () => {
    expect(toEnglishDigits('۱٬۲۵۰٬۰۰۰')).toBe('1250000');
    expect(toEnglishDigits('۰۹۱۲ ۳۴۵')).toBe('0912 345');
    expect(onlyDigits('۰۹۱۲ ۳۴۵')).toBe('0912345');
  });

  it('فقط ارقام را نگه می‌دارد', () => {
    expect(onlyDigits('+۹۸ (۹۱۲) ۳۴۵-۶۷۸۹')).toBe('989123456789');
  });

  it('عدد را با جداکننده هزارگان فارسی نمایش می‌دهد', () => {
    expect(formatPersianNumber(2500000)).toBe('۲٫۵۰۰٫۰۰۰');
    expect(formatPersianNumber(2500000, false)).toBe('2٫500٫000');
  });

  it('متن فارسی را نرمال می‌کند', () => {
    expect(normalizePersianText('حواي  كاري')).toBe('حوای کاری');
  });
});
