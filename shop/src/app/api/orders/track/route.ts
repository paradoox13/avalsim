import { ok, route, getClientIp } from '@/lib/api';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { notFound } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { tooManyRequests } from '@/lib/errors';
import { ORDER_STATUS_LABELS } from '@/lib/sms/templates';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  code: z.string().min(6).max(32).optional(),
  orderNumber: z.string().min(6).max(32).optional(),
  phone: z.string().optional(),
});

/** پیگیری سفارش با کد رهگیری یا شماره سفارش + آخرین ۴ رقم موبایل */
export const GET = route(async (request) => {
  const ip = getClientIp(request);
  const limit = await rateLimit(`track:${ip}`, 30, 300);
  if (!limit.ok) throw tooManyRequests();

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const query = querySchema.parse(params);

  const order = await prisma.order.findFirst({
    where: query.code
      ? { trackingCode: query.code.trim().toUpperCase() }
      : { orderNumber: query.orderNumber?.trim().toUpperCase() },
    include: { items: { select: { title: true, quantity: true, unitPrice: true, productType: true } } },
  });

  if (!order) throw notFound('سفارشی با این مشخصات یافت نشد');

  // برای جلوگیری از افشای اطلاعات، آخرین ۴ رقم موبایل الزامی است
  if (query.phone && !order.customerPhone.endsWith(query.phone.slice(-4))) {
    throw notFound('سفارشی با این مشخصات یافت نشد');
  }

  return ok({
    orderNumber: order.orderNumber,
    trackingCode: order.trackingCode,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status] ?? order.status,
    total: order.total,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    shippingCarrier: order.shippingCarrier,
    shippingTracking: order.shippingTracking,
    items: order.items,
  });
});
