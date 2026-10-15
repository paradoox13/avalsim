import { unauthorized, forbidden } from './errors';

/**
 * محافظت از اندپوینت‌های زمان‌بندی‌شده.
 * در محیط تولید، CRON_SECRET الزامی است.
 */
export function assertCronSecret(request: Request): void {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get('x-cron-secret') ?? new URL(request.url).searchParams.get('secret');

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw forbidden('CRON_SECRET تنظیم نشده است');
    }
    return; // در توسعه اجازه‌ی فراخوانی دستی می‌دهیم
  }
  if (!provided) throw unauthorized('کلید زمان‌بندی ارسال نشده است');
  if (provided !== secret) throw forbidden('کلید زمان‌بندی نامعتبر است');
}
