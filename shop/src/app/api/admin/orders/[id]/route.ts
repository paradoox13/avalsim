import { ok, readJson, route } from '@/lib/api';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { notFound } from '@/lib/errors';
import { cancelOrder, updateOrderStatus } from '@/lib/services/order.service';
import { tomanSchema } from '@/lib/validation/common';

export const dynamic = 'force-dynamic';

export const GET = route(async (_request, ctx: { params: { id: string } }) => {
  await requireStaffUser('orders.read');
  const order = await prisma.order.findUnique({
    where: { id: ctx.params.id },
    include: {
      items: { include: { phoneNumber: true, modem: true, operator: true } },
      payments: true,
      smsLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      user: { select: { id: true, fullName: true, phone: true, email: true } },
    },
  });
  if (!order) throw notFound('سفارش یافت نشد');
  return ok(order);
});

const patchSchema = z.object({
  action: z.enum(['status', 'cancel', 'mark-delivered']),
  status: z
    .enum(['PROCESSING', 'AWAITING_PHYSICAL_DELIVERY', 'SHIPPED', 'DELIVERED', 'REFUNDED'])
    .optional(),
  shippingCarrier: z.string().max(80).optional(),
  shippingTracking: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
  refundAmount: tomanSchema.optional(),
});

/** تغییر وضعیت / ثبت مرجوعی / لغو سفارش */
export const PATCH = route(async (request, ctx: { params: { id: string } }) => {
  await assertCsrf(request);
  const user = await requireStaffUser('orders.write');
  const input = await readJson(request, patchSchema);

  if (input.action === 'cancel') {
    await cancelOrder(ctx.params.id, input.note ?? 'لغو توسط مدیر');
    return ok({ canceled: true });
  }

  if (input.action === 'mark-delivered') {
    const updated = await updateOrderStatus(
      ctx.params.id,
      {
        status: 'DELIVERED',
        shippingCarrier: input.shippingCarrier,
        shippingTracking: input.shippingTracking,
        note: input.note,
      },
      { userId: user.id, roleKey: user.roleKey },
    );
    return ok(updated);
  }

  if (!input.status) throw notFound('وضعیت مقصد مشخص نشده است');

  const updated = await updateOrderStatus(
    ctx.params.id,
    {
      status: input.status,
      shippingCarrier: input.shippingCarrier,
      shippingTracking: input.shippingTracking,
      note: input.note,
    },
    { userId: user.id, roleKey: user.roleKey },
  );
  return ok(updated);
});
