import { ok, route, readJson, getClientIp } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { resellerRegisterSchema } from '@/lib/validation/auth';
import { registerReseller } from '@/lib/services/auth.service';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { tooManyRequests } from '@/lib/errors';
import { sendSms } from '@/lib/services/notification.service';
import { SMS_TEMPLATES, renderTemplate } from '@/lib/sms/templates';

export const POST = route(async (request) => {
  await assertCsrf(request);

  const ip = getClientIp(request);
  const limit = await rateLimit(`reseller-register:${ip}`, RATE_LIMITS.register.limit, RATE_LIMITS.register.window);
  if (!limit.ok) throw tooManyRequests();

  const input = await readJson(request, resellerRegisterSchema);
  const user = await registerReseller({
    fullName: input.fullName,
    phone: input.phone,
    email: input.email || undefined,
    password: input.password,
    nationalId: input.nationalId,
    shopName: input.shopName,
    province: input.province || undefined,
    city: input.city || undefined,
    address: input.address || undefined,
    postalCode: input.postalCode || undefined,
    shaba: input.shaba || undefined,
    cardNumber: input.cardNumber || undefined,
    bankName: input.bankName || undefined,
  });

  // پیامک خوش‌آمد (بدون توقف فرآیند در صورت خطا)
  const profile = await import('@/lib/prisma').then(({ prisma }) =>
    prisma.resellerProfile.findUnique({ where: { userId: user.id }, select: { code: true } }),
  );
  await sendSms({
    mobile: input.phone,
    userId: user.id,
    message: renderTemplate(SMS_TEMPLATES.resellerWelcome, {
      name: input.fullName,
      code: profile?.code ?? '-',
    }),
    label: 'reseller_welcome',
  });

  return ok({
    message: 'ثبت‌نام نمایندگی انجام شد و پس از تأیید مدیر، پنل شما فعال می‌شود.',
    resellerCode: profile?.code,
  });
});
