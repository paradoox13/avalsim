import { ok, readJson, route, getClientIp } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { contactSchema } from '@/lib/validation/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { tooManyRequests } from '@/lib/errors';
import { getAdminMobiles } from '@/lib/sms';
import { sendSms } from '@/lib/services/notification.service';

export const dynamic = 'force-dynamic';

/** ثبت پیام فرم تماس با ما */
export const POST = route(async (request) => {
  await assertCsrf(request);

  const ip = getClientIp(request);
  const limit = await rateLimit(`contact:${ip}`, RATE_LIMITS.contact.limit, RATE_LIMITS.contact.window);
  if (!limit.ok) throw tooManyRequests();

  const input = await readJson(request, contactSchema);
  const message = await prisma.contactMessage.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      subject: input.subject || null,
      message: input.message,
      ip,
    },
  });

  const admins = await getAdminMobiles();
  await Promise.all(
    admins.map((mobile) =>
      sendSms({
        mobile,
        message: `پیام جدید از ${input.name} (${input.phone}) در فرم تماس با ما`,
        label: 'contact_form',
      }),
    ),
  );

  return ok({ id: message.id, received: true });
});
