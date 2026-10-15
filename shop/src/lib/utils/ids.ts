import { randomBytes, randomInt } from 'node:crypto';
import { jalaliPeriodKey } from './jalali';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون I/O/0/1 برای خوانایی

function randomString(length: number): string {
  let out = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** کد رهگیری مشتری: ۱۰ کاراکتر خوانا */
export function generateTrackingCode(): string {
  return randomString(10);
}

/** شماره‌ی سفارش با شماره‌ی ترتیبی روزانه: SH-14030812-000123 */
export function buildOrderNumber(sequence: number, date: Date = new Date()): string {
  const period = jalaliPeriodKey(date);
  const day = period + String(date.getDate()).padStart(2, '0');
  return `SH-${day}-${String(sequence).padStart(6, '0')}`;
}

/** کلید شمارنده‌ی روزانه سفارش */
export function orderSequenceKey(date: Date = new Date()): string {
  const period = jalaliPeriodKey(date);
  return `order:${period}${String(date.getDate()).padStart(2, '0')}`;
}

/** کد نماینده: RSL-0001 */
export function buildResellerCode(sequence: number): string {
  return `RSL-${String(sequence).padStart(4, '0')}`;
}

/** توکن تصادفی امن (برای سبد خرید، CSRF، توکن رزرو) */
export function secureToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

/** کد عددی برای تأیید پیامکی (OTP) */
export function generateOtpCode(digits = 5): string {
  const max = 10 ** digits;
  return String(randomInt(0, max)).padStart(digits, '0');
}

/**
 * شمارنده‌ی اتمی در دیتابیس.
 * از `UPDATE ... RETURNING` استفاده می‌کند تا تحت همزمانی، شماره‌ی تکراری تولید نشود.
 */
export async function nextSequence(
  tx: { $queryRaw: <T>(q: TemplateStringsArray, ...v: unknown[]) => Promise<T> },
  key: string,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "Counter" ("key", "value", "updatedAt")
    VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1, "updatedAt" = NOW()
    RETURNING "value"
  `;
  const row = rows[0];
  if (!row) throw new Error('خطا در تولید شمارنده');
  return row.value;
}
