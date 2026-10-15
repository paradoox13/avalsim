import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../prisma';
import { badRequest, conflict, forbidden, notFound, paymentError } from '../errors';
import { writeAudit } from '../audit';
import { getSettingBoolean, getSettingNumber, getSettingString } from '../settings';
import { basisPointsOf, mulToman, sumToman } from '../utils/money';
import { buildOrderNumber, generateTrackingCode, nextSequence, orderSequenceKey, secureToken } from '../utils/ids';
import { getCartView } from './cart.service';
import { reservePhoneNumbers } from './phone.service';
import { decreaseModemStock } from './modem.service';
import { getPaymentGateway, getConfiguredCallbackBaseUrl } from '../payments';
import { notifyAdminsOfNewOrder, notifyCustomerOrderPaid, notifyResellerSale } from './notification.service';
import { isValidIranianNationalId } from '../validation/common';
import type { PaymentGatewayAdapter } from '../payments/types';

export interface CheckoutInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  nationalId?: string;
  province?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  note?: string;
}

export interface CheckoutContext {
  cartToken: string;
  userId?: string | null;
  request: Request;
}

export interface CheckoutResult {
  order: { id: string; orderNumber: string; trackingCode: string; total: bigint };
  paymentId: string;
  redirectUrl: string;
}

function buildAddressText(input: CheckoutInput): string | null {
  const parts = [input.province, input.city, input.address].filter(Boolean);
  return parts.length ? parts.join('، ') : null;
}

/**
 * ایجاد سفارش و هدایت به درگاه پرداخت.
 *
 * ترتیب عملیات:
 * ۱) اعتبارسنجی سبد خرید (قیمت و موجودی زنده)
 * ۲) تراکنش دیتابیس: ثبت سفارش + رزرو موقت شماره‌ها + اقلام سفارش
 * ۳) فراخوانی درگاه پرداخت و ثبت رکورد Payment
 * ۴) در صورت خطای درگاه، رزرو آزاد و سفارش ناموفق ثبت می‌شود
 */
export async function createOrderAndPayment(
  input: CheckoutInput,
  ctx: CheckoutContext,
): Promise<CheckoutResult> {
  const cart = await getCartView(ctx.cartToken, ctx.userId);

  if (!cart.items.length) throw badRequest('سبد خرید خالی است');

  const unavailable = cart.items.filter((i) => !i.available);
  if (unavailable.length) {
    throw conflict(
      `این اقلام قابل خرید نیستند: ${unavailable.map((i) => `${i.title} (${i.issue ?? 'ناموجود'})`).join('، ')}`,
    );
  }

  const minOrder = await getSettingNumber('shop.minOrderAmount');
  if (minOrder > 0 && cart.totals.total < BigInt(minOrder)) {
    throw badRequest(`حداقل مبلغ سفارش ${minOrder} تومان است`);
  }

  const requiresPhysical = cart.totals.requiresPhysicalDelivery;
  const shippingEnabled = await getSettingBoolean('shop.shipToCustomerEnabled');
  if (requiresPhysical && shippingEnabled && !input.address) {
    throw badRequest('برای این سفارش، وارد کردن نشانی تحویل الزامی است');
  }

  const hasActivation = cart.items.some((i) => i.productType === 'ACTIVATION_CODE');
  const nationalIdRequired = await getSettingBoolean('shop.requireNationalIdForActivation');
  if (hasActivation && nationalIdRequired) {
    if (!input.nationalId || !isValidIranianNationalId(input.nationalId)) {
      throw badRequest('برای خرید کد فعال‌سازی وارد کردن کد ملی معتبر الزامی است');
    }
    if (!ctx.userId) {
      throw badRequest('برای خرید کد فعال‌سازی ابتدا وارد حساب کاربری شوید');
    }
  }

  const reservationMinutes = (await getSettingNumber('shop.reservationMinutes')) || 15;

  // ----- ۱) تراکنش ثبت سفارش و رزرو -----
  const created = await prisma.$transaction(async (tx) => {
    const sequence = await nextSequence(tx, orderSequenceKey());
    const orderNumber = buildOrderNumber(sequence);
    const trackingCode = generateTrackingCode();

    const cartItems = await tx.cartItem.findMany({ where: { cartId: cart.id } });
    const phoneIds = cartItems
      .filter((i) => i.productType === 'PHONE_NUMBER' && i.phoneNumberId)
      .map((i) => i.phoneNumberId as string);

    const order = await tx.order.create({
      data: {
        orderNumber,
        trackingCode,
        userId: ctx.userId ?? null,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        nationalId: input.nationalId ?? null,
        province: input.province ?? null,
        city: input.city ?? null,
        address: buildAddressText(input),
        postalCode: input.postalCode ?? null,
        note: input.note ?? null,
        type: cart.items.length === 1 ? cart.items[0].productType : null,
        status: 'PENDING_PAYMENT',
        subtotal: cart.totals.subtotal,
        discount: cart.totals.discount,
        tax: cart.totals.tax,
        total: cart.totals.total,
        reservationExpiresAt: new Date(Date.now() + reservationMinutes * 60_000),
        cartToken: ctx.cartToken,
        ipAddress: ctx.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: ctx.request.headers.get('user-agent') ?? null,
      },
    });

    // رزرو موقت شماره‌ها — قفل فروش همزمان
    if (phoneIds.length) {
      const reservation = await reservePhoneNumbers(tx, phoneIds, order.id, reservationMinutes);
      if (reservation.failed.length) {
        throw conflict('یکی از شماره‌های انتخابی هم‌اکنون توسط کاربر دیگری رزرو شده است. لطفاً سبد خرید را به‌روزرسانی کنید.');
      }
    }

    // اقلام سفارش + محاسبه‌ی کمیسیون نماینده‌ها
    let commissionTotal = 0n;
    for (const line of cart.items) {
      let ownerType: 'PLATFORM' | 'RESELLER' = 'PLATFORM';
      let resellerId: string | null = null;
      let commissionRate = 0;

      if (line.productType === 'PHONE_NUMBER' && line.phoneNumberId) {
        const phone = await tx.phoneNumber.findUnique({
          where: { id: line.phoneNumberId },
          include: { reseller: { include: { resellerProfile: true } } },
        });
        ownerType = (phone?.ownerType as 'PLATFORM' | 'RESELLER') ?? 'PLATFORM';
        resellerId = phone?.resellerId ?? null;
        commissionRate = phone?.reseller?.resellerProfile?.commissionRate ?? 0;
      } else if (line.productType === 'MODEM' && line.modemId) {
        const modem = await tx.modem.findUnique({
          where: { id: line.modemId },
          include: { reseller: { include: { resellerProfile: true } } },
        });
        ownerType = (modem?.ownerType as 'PLATFORM' | 'RESELLER') ?? 'PLATFORM';
        resellerId = modem?.resellerId ?? null;
        commissionRate = modem?.reseller?.resellerProfile?.commissionRate ?? 0;
      }

      const lineTotal = mulToman(line.unitPrice, line.quantity);
      const commissionAmount =
        ownerType === 'RESELLER' && commissionRate > 0
          ? basisPointsOf(lineTotal, commissionRate)
          : 0n;
      commissionTotal += commissionAmount;

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productType: line.productType,
          title: line.title,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          totalPrice: lineTotal,
          phoneNumberId: line.phoneNumberId,
          modemId: line.modemId,
          operatorId: line.operatorId,
          ownerType,
          resellerId: resellerId && ownerType === 'RESELLER' ? resellerId : null,
          commissionRate,
          commissionAmount,
          meta: (line.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }

    if (commissionTotal > 0n) {
      await tx.order.update({ where: { id: order.id }, data: { resellerCommission: commissionTotal } });
    }

    return order;
  }, { timeout: 20_000 });

  // ----- ۲) اتصال به درگاه پرداخت -----
  const gateway = await getPaymentGateway();
  const baseUrl = await getConfiguredCallbackBaseUrl(ctx.request);
  const callbackUrl = `${baseUrl}/api/payment/callback/${gateway.name}?order=${created.orderNumber}`;

  let payment: { id: string } | null = null;
  try {
    const requestResult = await gateway.requestPayment({
      amountToman: created.total,
      orderId: created.id,
      orderNumber: created.orderNumber,
      description: `پرداخت سفارش ${created.orderNumber}`,
      callbackUrl,
      mobile: input.customerPhone,
      email: input.customerEmail,
    });

    payment = await prisma.payment.create({
      data: {
        orderId: created.id,
        gateway: gateway.name,
        amount: created.total,
        status: 'INITIATED',
        authority: requestResult.authority,
        requestPayload: requestResult.raw as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return {
      order: {
        id: created.id,
        orderNumber: created.orderNumber,
        trackingCode: created.trackingCode,
        total: created.total,
      },
      paymentId: payment.id,
      redirectUrl: requestResult.redirectUrl,
    };
  } catch (error) {
    // خطای درگاه: آزادسازی رزرو و ثبت سفارش ناموفق
    await prisma.$transaction(async (tx) => {
      await tx.phoneNumber.updateMany({
        where: { soldOrderId: null, reservedByToken: created.id },
        data: { status: 'AVAILABLE', reservedAt: null, reservedUntil: null, reservedByToken: null },
      });
      await tx.order.update({
        where: { id: created.id },
        data: { status: 'FAILED', canceledAt: new Date() },
      });
    });
    console.error('[checkout] gateway request failed:', error);
    throw paymentError(
      `اتصال به درگاه پرداخت ناموفق بود. ${error instanceof Error ? error.message : ''}`.trim(),
    );
  }
}

/**
 * تسویه‌ی نهایی سفارش پس از تأیید موفق تراکنش.
 * این تابع idempotent است: فراخوانی دوباره باعث فروش مجدد یا کاهش دوباره‌ی موجودی نمی‌شود.
 */
export async function finalizePaidOrder(
  orderNumber: string,
  paymentData: { gateway: string; authority: string; refId?: string; cardPan?: string; raw: unknown },
) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });
  if (!order) throw notFound('سفارش یافت نشد');

  if (order.status === 'PAID' || order.status === 'PROCESSING' || order.status === 'AWAITING_PHYSICAL_DELIVERY' || order.status === 'SHIPPED' || order.status === 'DELIVERED') {
    // قبلاً پردازش شده — از ارسال دوباره‌ی پیامک جلوگیری می‌کنیم
    return { order, alreadyProcessed: true as const };
  }

  const hasPhysical = order.items.some(
    (i) => i.productType === 'MODEM' || i.productType === 'ACTIVATION_CODE',
  );

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { orderId: order.id, authority: paymentData.authority },
      data: {
        status: 'VERIFIED',
        refId: paymentData.refId ?? null,
        cardPan: paymentData.cardPan ?? null,
        verifyPayload: paymentData.raw as Prisma.InputJsonValue,
        verifiedAt: new Date(),
      },
    });

    // فروش شماره‌ها: فقط اگر همین سفارش آن‌ها را رزرو کرده باشد
    for (const item of order.items) {
      if (item.productType === 'PHONE_NUMBER' && item.phoneNumberId) {
        const result = await tx.phoneNumber.updateMany({
          where: {
            id: item.phoneNumberId,
            soldOrderId: null,
            OR: [
              { status: 'RESERVED', reservedByToken: order.id },
              { status: 'AVAILABLE' },
            ],
          },
          data: {
            status: 'SOLD',
            soldAt: new Date(),
            soldOrderId: order.id,
            reservedAt: null,
            reservedUntil: null,
            reservedByToken: null,
          },
        });
        if (result.count !== 1) {
          throw conflict(`شماره‌ی سفارش ${item.title} در دسترس نیست. لطفاً با پشتیبانی تماس بگیرید.`);
        }
      }

      if (item.productType === 'MODEM' && item.modemId) {
        // کاهش موجودی با شرط stock >= quantity داخل تراکنش
        const ok = await tx.modem.updateMany({
          where: { id: item.modemId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (ok.count !== 1) throw conflict(`موجودی ${item.title} کافی نیست`);
        await tx.modem.updateMany({ where: { id: item.modemId, stock: { lte: 0 } }, data: { isActive: false } });
        await tx.orderItem.update({ where: { id: item.id }, data: { deliveredAt: new Date() } });
      }

      if (item.productType === 'ACTIVATION_CODE') {
        await tx.orderItem.update({ where: { id: item.id }, data: { deliveredAt: null } });
      }
    }

    // واریز کمیسیون به مانده‌ی نمایندگان
    for (const item of order.items) {
      if (item.ownerType === 'RESELLER' && item.resellerId) {
        await tx.resellerProfile.updateMany({
          where: { userId: item.resellerId },
          data: {
            balance: { increment: item.commissionAmount },
            totalSales: { increment: item.totalPrice },
            totalCommission: { increment: item.commissionAmount },
          },
        });
      }
    }

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: hasPhysical ? 'AWAITING_PHYSICAL_DELIVERY' : 'PROCESSING',
        paidAt: new Date(),
        reservationExpiresAt: null,
      },
      include: { items: true },
    });
  }, { timeout: 20_000 });

  // پاک‌سازی سبد خرید مربوط به این سفارش
  if (order.cartToken) {
    await prisma.cartItem
      .deleteMany({ where: { cart: { token: order.cartToken } } })
      .catch(() => undefined);
  }

  await writeAudit({
    userId: order.userId,
    action: 'PAYMENT_VERIFIED',
    entity: 'Order',
    entityId: order.id,
    after: { orderNumber, refId: paymentData.refId, gateway: paymentData.gateway },
  });

  // اعلان‌ها بعد از موفقیت تراکنش دیتابیس
  await notifyCustomerOrderPaid({
    id: updated.id,
    customerName: updated.customerName,
    customerPhone: updated.customerPhone,
    orderNumber: updated.orderNumber,
    total: updated.total,
    trackingCode: updated.trackingCode,
    userId: updated.userId,
  });

  if (hasPhysical) {
    await notifyAdminsOfNewOrder({
      id: updated.id,
      orderNumber: updated.orderNumber,
      total: updated.total,
      customerName: updated.customerName,
      requiresPhysicalDelivery: true,
    });
  }

  // اطلاع به نمایندگان صاحب محصول
  const resellerItems = updated.items.filter((i) => i.ownerType === 'RESELLER' && i.resellerId);
  const perReseller = new Map<string, bigint>();
  for (const item of resellerItems) {
    perReseller.set(item.resellerId!, (perReseller.get(item.resellerId!) ?? 0n) + item.commissionAmount);
  }
  for (const [resellerUserId, amount] of perReseller) {
    const profile = await prisma.resellerProfile.findUnique({
      where: { userId: resellerUserId },
      include: { user: { select: { phone: true } } },
    });
    if (profile) {
      await notifyResellerSale({
        mobile: profile.phone,
        userId: resellerUserId,
        amount,
        balance: profile.balance,
      });
    }
  }

  return { order: updated, alreadyProcessed: false as const };
}

/** لغو سفارش و آزادسازی رزروها */
export async function cancelOrder(orderId: string, reason?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('سفارش یافت نشد');
  if (['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
    throw conflict('سفارش پرداخت‌شده را نمی‌توان لغو کرد؛ از فرآیند مرجوعی استفاده کنید');
  }

  await prisma.$transaction(async (tx) => {
    await tx.phoneNumber.updateMany({
      where: { reservedByToken: orderId, soldOrderId: null },
      data: { status: 'AVAILABLE', reservedAt: null, reservedUntil: null, reservedByToken: null },
    });
    await tx.payment.updateMany({
      where: { orderId, status: { in: ['INITIATED', 'CALLBACK_RECEIVED'] } },
      data: { status: 'CANCELED' },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELED', canceledAt: new Date(), note: reason ?? order.note },
    });
  });

  await writeAudit({
    action: 'CANCEL',
    entity: 'Order',
    entityId: orderId,
    after: { reason },
  });
}

/** آزادسازی سفارش‌های منقضی (پرداخت ناتمام) */
export async function cancelExpiredOrders(): Promise<number> {
  const expired = await prisma.order.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      reservationExpiresAt: { lt: new Date() },
    },
    select: { id: true },
    take: 200,
  });

  for (const order of expired) {
    await cancelOrder(order.id, 'انقضای مهلت پرداخت');
  }
  return expired.length;
}

export interface OrderStatusChange {
  status: 'PROCESSING' | 'AWAITING_PHYSICAL_DELIVERY' | 'SHIPPED' | 'DELIVERED' | 'CANCELED' | 'REFUNDED';
  shippingCarrier?: string;
  shippingTracking?: string;
  note?: string;
}

/** تغییر وضعیت سفارش توسط ادمین */
export async function updateOrderStatus(
  orderId: string,
  change: OrderStatusChange,
  actor: { userId: string; roleKey: string },
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('سفارش یافت نشد');

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: change.status,
      ...(change.shippingCarrier !== undefined ? { shippingCarrier: change.shippingCarrier } : {}),
      ...(change.shippingTracking !== undefined ? { shippingTracking: change.shippingTracking } : {}),
      ...(change.note !== undefined ? { note: change.note } : {}),
      ...(change.status === 'SHIPPED' ? { shippedAt: new Date() } : {}),
      ...(change.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      ...(change.status === 'CANCELED' ? { canceledAt: new Date() } : {}),
    },
  });

  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'STATUS_CHANGE',
    entity: 'Order',
    entityId: orderId,
    before: { status: order.status },
    after: { status: updated.status },
  });

  const { notifyOrderStatus } = await import('./notification.service');
  await notifyOrderStatus({
    id: updated.id,
    customerPhone: updated.customerPhone,
    orderNumber: updated.orderNumber,
    status: updated.status,
    trackingCode: updated.trackingCode,
  });

  return updated;
}

export async function getOrderByTrackingCode(trackingCode: string, userId?: string | null) {
  const order = await prisma.order.findUnique({
    where: { trackingCode },
    include: { items: true },
  });
  if (!order) throw notFound('سفارشی با این کد رهگیری یافت نشد');
  // سفارش‌های مهمان با کد رهگیری قابل مشاهده‌اند؛ سفارش‌های کاربران فقط برای خودشان
  if (userId && order.userId && order.userId !== userId) throw forbidden();
  return order;
}

export async function listUserOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: { items: true, payments: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export function requiresPhysicalDelivery(items: Array<{ productType: string }>): boolean {
  return items.some((i) => i.productType === 'MODEM' || i.productType === 'ACTIVATION_CODE');
}

export { secureToken, sumToman };
