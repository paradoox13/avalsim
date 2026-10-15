/**
 * ابزارهای عدد و حرف فارسی
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

/** تبدیل ارقام لاتین به فارسی برای نمایش */
export function toPersianDigits(input: string | number | bigint): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/**
 * تبدیل ارقام فارسی/عربی به لاتین برای پارس کردن ورودی کاربر.
 * ورودی‌ها همیشه باید با این تابع نرمال شوند.
 */
export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\u200c/g, '') // نیم‌فاصله
    .replace(/٬|,|،/g, '')
    .trim();
}

/** فقط ارقام لاتین را نگه می‌دارد */
export function onlyDigits(input: string): string {
  return toEnglishDigits(input).replace(/\D/g, '');
}

/** جداکننده هزارگان + ارقام فارسی */
export function formatPersianNumber(value: number | bigint, persian = true): string {
  const raw = typeof value === 'bigint' ? value.toString() : String(Math.trunc(value));
  const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '٫');
  return persian ? toPersianDigits(formatted) : formatted;
}

/** نرمال‌سازی متن فارسی: ي/ك عربی، حذف فاصله‌های اضافه */
export function normalizePersianText(input: string): string {
  return input
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u064B-\u0652/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
