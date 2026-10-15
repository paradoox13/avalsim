import { ok, route, readJson } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { twoFactorSchema } from '@/lib/validation/auth';
import { getSessionPayload, getCurrentUser, createSessionForUser, setSessionCookie } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { unauthorized } from '@/lib/errors';
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  startTwoFactorSetup,
  verifyLoginTwoFactor,
} from '@/lib/services/auth.service';
import { homePathForRole } from '@/lib/auth/rbac';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { tooManyRequests } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** مرحله‌ی دوم ورود: تأیید کد TOTP */
export const POST = route(async (request) => {
  await assertCsrf(request);
  const payload = await getSessionPayload();
  if (!payload || payload.roleKey !== 'PENDING_2FA') throw unauthorized('ابتدا رمز عبور را وارد کنید');

  const limit = await rateLimit(`2fa:${payload.sub}`, RATE_LIMITS.otp.limit, RATE_LIMITS.otp.window);
  if (!limit.ok) throw tooManyRequests();

  const { code } = await readJson(request, twoFactorSchema);
  const valid = await verifyLoginTwoFactor(payload.sub, code);
  if (!valid) throw unauthorized('کد تأیید نادرست است');

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { resellerProfile: { select: { id: true } } },
  });
  if (!user) throw unauthorized();

  const token = await createSessionForUser({
    id: user.id,
    roleKey: user.roleKey,
    tokenVersion: user.tokenVersion,
    resellerId: user.resellerProfile?.id ?? null,
  });
  await setSessionCookie(token);
  return ok({ verified: true, redirectTo: homePathForRole(user.roleKey) });
});

/** شروع فعال‌سازی دو مرحله‌ای برای کاربر وارد‌شده */
export const PUT = route(async (request) => {
  await assertCsrf(request);
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  const setup = await startTwoFactorSetup(user.id);
  return ok({ secret: setup.secret, qrDataUrl: setup.qrDataUrl });
});

/** تأیید فعال‌سازی با کد */
export const PATCH = route(async (request) => {
  await assertCsrf(request);
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  const { code } = await readJson(request, twoFactorSchema);
  return ok(await confirmTwoFactorSetup(user.id, code));
});

/** غیرفعال‌سازی */
export const DELETE = route(async (request) => {
  await assertCsrf(request);
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  const { code } = await readJson(request, twoFactorSchema);
  return ok(await disableTwoFactor(user.id, code));
});
