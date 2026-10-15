import { ok, route, readJson, getClientIp } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { checkoutSchema } from '@/lib/validation/auth';
import { getCartToken } from '@/lib/cart-session';
import { getCurrentUser } from '@/lib/auth/session';
import { createOrderAndPayment } from '@/lib/services/order.service';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { badRequest, tooManyRequests } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * ثبت سفارش و دریافت آدرس درگاه پرداخت.
 * پاسخ شامل `redirectUrl` است که فرانت‌اند کاربر را به آن هدایت می‌کند.
 */
export const POST = route(async (request) => {
  await assertCsrf(request);

  const ip = getClientIp(request);
  const limit = await rateLimit(`checkout:${ip}`, RATE_LIMITS.checkout.limit, RATE_LIMITS.checkout.window);
  if (!limit.ok) throw tooManyRequests('تعداد تلاش‌های پرداخت بیش از حد مجاز است');

  const token = await getCartToken();
  if (!token) throw badRequest('سبد خرید خالی است');

  const input = await readJson(request, checkoutSchema);
  const user = await getCurrentUser();

  const result = await createOrderAndPayment(
    {
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail || undefined,
      nationalId: input.nationalId || undefined,
      province: input.province || undefined,
      city: input.city || undefined,
      address: input.address || undefined,
      postalCode: input.postalCode || undefined,
      note: input.note || undefined,
    },
    { cartToken: token, userId: user?.id ?? null, request },
  );

  return ok({
    orderNumber: result.order.orderNumber,
    trackingCode: result.order.trackingCode,
    total: result.order.total,
    redirectUrl: result.redirectUrl,
  });
});
