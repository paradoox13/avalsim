import { ok, readJson, route } from '@/lib/api';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { msisdnSchema } from '@/lib/validation/common';
import { sendSms } from '@/lib/services/notification.service';
import { rateLimit } from '@/lib/rate-limit';
import { tooManyRequests } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const schema = z.object({
  mobile: msisdnSchema,
  message: z.string().min(3).max(500),
});

/** ارسال پیامک دستی از پنل ادمین */
export const POST = route(async (request) => {
  await assertCsrf(request);
  const user = await requireStaffUser('sms.send');

  const limit = await rateLimit(`sms-manual:${user.id}`, 50, 3600);
  if (!limit.ok) throw tooManyRequests('سهمیه ارسال پیامک دستی در این ساعت پر شده است');

  const input = await readJson(request, schema);
  const result = await sendSms({
    mobile: input.mobile,
    message: input.message,
    userId: user.id,
    label: 'manual',
  });
  return ok(result);
});
