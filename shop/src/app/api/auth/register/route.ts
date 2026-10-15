import { ok, route, readJson, getClientIp, getUserAgent } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { registerSchema } from '@/lib/validation/auth';
import { registerCustomer } from '@/lib/services/auth.service';
import { createSessionForUser, setSessionCookie } from '@/lib/auth/session';
import { issueCsrfToken as issueCsrf } from '@/lib/csrf';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { tooManyRequests } from '@/lib/errors';

export const POST = route(async (request) => {
  await assertCsrf(request);

  const ip = getClientIp(request);
  const limit = await rateLimit(`register:${ip}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.window);
  if (!limit.ok) throw tooManyRequests('تعداد ثبت‌نام‌ها از این IP بیش از حد مجاز است');

  const input = await readJson(request, registerSchema);
  const user = await registerCustomer({
    fullName: input.fullName,
    phone: input.phone,
    email: input.email || undefined,
    password: input.password,
    nationalId: input.nationalId || undefined,
  });

  const token = await createSessionForUser({
    id: user.id,
    roleKey: user.roleKey,
    tokenVersion: user.tokenVersion,
  });
  await setSessionCookie(token);
  await issueCsrf();

  return ok({
    user: { id: user.id, fullName: user.fullName, phone: user.phone, roleKey: user.roleKey },
    redirectTo: '/',
    clientIp: ip,
    userAgent: getUserAgent(request) !== 'unknown',
  });
});
