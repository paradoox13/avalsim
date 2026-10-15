import { ok, route } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { requireApprovedReseller } from '@/lib/guards';
import { processExcelUpload } from '@/lib/services/excel-upload.service';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { tooManyRequests } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * ایمپورت گروهی محصولات نماینده از فایل اکسل.
 * نوع فایل با فیلد `type` مشخص می‌شود: PHONE_NUMBERS یا MODEMS
 */
export const POST = route(async (request) => {
  await assertCsrf(request);
  const { user, resellerId } = await requireApprovedReseller();

  const limit = await rateLimit(`import:${resellerId}`, RATE_LIMITS.excelImport.limit, RATE_LIMITS.excelImport.window);
  if (!limit.ok) throw tooManyRequests('تعداد ایمپورت‌های امروز از حد مجاز گذشته است');

  const typeField = new URL(request.url).searchParams.get('type');
  const type = typeField === 'MODEMS' ? 'MODEMS' : 'PHONE_NUMBERS';

  const result = await processExcelUpload(
    request,
    { userId: user.id, roleKey: user.roleKey, permissions: user.permissions, resellerId },
    type,
  );

  return ok(result);
});
