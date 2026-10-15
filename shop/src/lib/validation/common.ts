import { z } from 'zod';
import { normalizeMsisdn } from '../filters/operator-detect';
import { toEnglishDigits } from '../utils/persian';

/** اعتبارسنجی کد ملی ایران (الگوریتم رقم کنترلی) */
export function isValidIranianNationalId(input: string): boolean {
  const code = toEnglishDigits(input).replace(/\D/g, '');
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false; // ارقام تکراری مثل ۱۱۱۱۱۱۱۱۱۱
  const check = Number(code[9]);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(code[i]) * (10 - i);
  const remainder = sum % 11;
  return (remainder < 2 && check === remainder) || (remainder >= 2 && check === 11 - remainder);
}

/** اعتبارسنجی شماره شبا (IBAN ایران) */
export function isValidShaba(input: string): boolean {
  const raw = toEnglishDigits(input).replace(/\s/g, '').toUpperCase();
  if (!/^IR\d{24}$/.test(raw)) return false;
  const rearranged = raw.slice(4) + raw.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const numeric = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const digit of numeric) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

export const msisdnSchema = z
  .string()
  .transform((v) => normalizeMsisdn(v) ?? '')
  .refine((v) => /^09\d{9}$/.test(v), { message: 'شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)' });

export const nationalIdSchema = z
  .string()
  .transform((v) => toEnglishDigits(v).replace(/\D/g, ''))
  .refine(isValidIranianNationalId, { message: 'کد ملی معتبر نیست' });

export const shabaSchema = z
  .string()
  .transform((v) => toEnglishDigits(v).replace(/\s/g, '').toUpperCase())
  .refine(isValidShaba, { message: 'شماره شبا معتبر نیست (مثال: IR000000000000000000000000)' });

/** مبلغ تومان: رشته/عدد → BigInt و اعتبارسنجی محدوده */
export const tomanSchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((v, ctx) => {
    // مقادیر منفی باید صریحاً رد شوند (نه اینکه علامت حذف و مثبت فرض شود)
    const rawText = String(v);
    if (rawText.includes('-') || rawText.includes('−')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'مبلغ نمی‌تواند منفی باشد' });
      return 0n;
    }
    try {
      const digits = typeof v === 'string' ? toEnglishDigits(v).replace(/[^\d]/g, '') : String(v);
      if (!digits) throw new Error('empty');
      const value = BigInt(digits);
      if (value < 0n) throw new Error('negative');
      if (value > 1_000_000_000_000n) throw new Error('too-large');
      return value;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'مبلغ نامعتبر است' });
      return 0n;
    }
  });

/** متن فارسی با طول محدود و پاکسازی */
export function persianText(max: number, min = 1) {
  return z
    .string()
    .transform((v) => v.replace(/[<>]/g, '').trim())
    .refine((v) => v.length >= min, { message: `حداقل ${min} کاراکتر لازم است` })
    .refine((v) => v.length <= max, { message: `حداکثر ${max} کاراکتر مجاز است` });
}

/** مقادیر بولین که از کوئری‌استرینگ می‌آیند */
export const booleanish = z
  .union([z.boolean(), z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (typeof v === 'boolean') return v;
    return ['true', '1', 'yes', 'on'].includes(String(v).toLowerCase());
  });

export const pageSchema = z.coerce.number().int().min(1).catch(1);
export const limitSchema = z.coerce.number().int().min(1).max(100).catch(24);

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'شناسه نامعتبر است')
  .max(64);

export const captchaAnswerSchema = z.coerce.number().int();
