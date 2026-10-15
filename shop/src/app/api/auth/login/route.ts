import { ok, route, readJson, getClientIp, getUserAgent } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { loginSchema } from '@/lib/validation/auth';
import { authenticate } from '@/lib/services/auth.service';
import { createSessionForUser, setSessionCookie, clearSessionCookie } from '@/lib/auth/session';
import { signPendingTwoFactor } from '@/lib/auth/jwt';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { tooManyRequests } from '@/lib/errors';
import { homePathForRole } from '@/lib/auth/rbac';

const ROLE_BY_PORTAL: Record<string, string[]> = {
  customer: ['CUSTOMER', 'RESELLER', 'ADMIN', 'SUPER_ADMIN'],
  reseller: ['RESELLER'],
  admin: ['ADMIN', 'SUPER_ADMIN'],
};

export const POST = route(async (request) => {
  await assertCsrf(request);

  const ip = getClientIp(request);
  const limit = await rateLimit(`login:${ip}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.window);
  if (!limit.ok) throw tooManyRequests('تلاش‌های ورود بیش از حد مجاز است. چند دقیقه بعد تلاش کنید.');

  const input = await readJson(request, loginSchema);

  const result = await authenticate({
    identifier: input.identifier,
    password: input.password,
    ip,
    userAgent: getUserAgent(request),
    expectedRoles: ROLE_BY_PORTAL[String(input.portal)] ?? ROLE_BY_PORTAL.customer,
  });

  if (result.requiresTwoFactor) {
    // توکن کوتاه‌عمر برای مرحله‌ی دوم؛ کاربر هنوز وارد نشده است
    const pendingToken = await signPendingTwoFactor(result.user.id);
    await setSessionCookie(pendingToken, 300);
    return ok({
      requiresTwoFactor: true,
      message: 'کد تأیید دو مرحله‌ای را از اپلیکیشن Authenticator وارد کنید',
    });
  }

  const token = await createSessionForUser({
    id: result.user.id,
    roleKey: result.user.roleKey,
    tokenVersion: result.user.tokenVersion,
    resellerId: result.user.resellerId,
  });
  await setSessionCookie(token);

  return ok({
    requiresTwoFactor: false,
    user: {
      id: result.user.id,
      fullName: result.user.fullName,
      roleKey: result.user.roleKey,
    },
    redirectTo: homePathForRole(result.user.roleKey),
  });
});

/** خروج از حساب */
export const DELETE = route(async (request) => {
  await assertCsrf(request);
  await clearSessionCookie();
  return ok({ loggedOut: true });
});
