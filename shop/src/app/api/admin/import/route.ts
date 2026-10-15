import { ok, route } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { processExcelUpload } from '@/lib/services/excel-upload.service';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { tooManyRequests } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** ایمپورت اکسل در سطح پلتفرم (ادمین) */
export const POST = route(async (request) => {
  await assertCsrf(request);
  const user = await requireStaffUser('products.phones.write');

  const limit = await rateLimit(`admin-import:${user.id}`, RATE_LIMITS.excelImport.limit, RATE_LIMITS.excelImport.window);
  if (!limit.ok) throw tooManyRequests();

  const typeField = new URL(request.url).searchParams.get('type');
  const type = typeField === 'MODEMS' ? 'MODEMS' : 'PHONE_NUMBERS';

  const result = await processExcelUpload(
    request,
    { userId: user.id, roleKey: user.roleKey, permissions: user.permissions, resellerId: null },
    type,
  );
  return ok(result);
});
