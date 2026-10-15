import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPaymentGateway, getConfiguredCallbackBaseUrl } from '@/lib/payments';
import type { GatewayName } from '@/lib/payments/types';
import { finalizePaidOrder, cancelOrder } from '@/lib/services/order.service';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const VALID_GATEWAYS: GatewayName[] = ['ZARINPAL', 'IDPAY', 'NEXTPAY'];

/**
 * بازگشت از درگاه پرداخت.
 *
 * امنیت: هرگز به پارامترهای callback اعتماد نمی‌کنیم و همیشه تراکنش را
 * سرور به سرور (verify) تأیید می‌کنیم. عملیات تسویه idempotent است.
 */
async function handle(request: Request, gatewayName: string): Promise<NextResponse> {
  const baseUrl = await getConfiguredCallbackBaseUrl(request);
  const url = new URL(request.url);

  const failRedirect = (reason: string, orderNumber?: string | null) => {
    const target = new URL('/payment/result', baseUrl);
    target.searchParams.set('status', 'failed');
    target.searchParams.set('reason', reason);
    if (orderNumber) target.searchParams.set('order', orderNumber);
    return NextResponse.redirect(target, { status: 303 });
  };

  if (!VALID_GATEWAYS.includes(gatewayName.toUpperCase() as GatewayName)) {
    return failRedirect('gateway');
  }

  const configured = await getPaymentGateway();
  if (configured.name !== gatewayName.toUpperCase()) {
    // callback برای درگاهی که فعال نیست
    return failRedirect('inactive_gateway');
  }

  const parsed = await configured.parseCallback(request);
  const orderNumberFromQuery = url.searchParams.get('order');
  const orderNumberFromBody = parsed.payload.order_id ?? parsed.payload.orderId ?? null;
  const authority = parsed.authority;

  if (!authority) return failRedirect('missing_authority', orderNumberFromQuery);

  // یافتن پرداخت بر اساس شناسه‌ی درگاه
  const payment = await prisma.payment.findUnique({
    where: { authority },
    include: { order: true },
  });
  if (!payment) return failRedirect('payment_not_found', orderNumberFromQuery);

  const order = payment.order;
  const orderNumber = order.orderNumber || orderNumberFromQuery || '';

  if (payment.status === 'VERIFIED') {
    // پرداخت تکراری callback — کاربر به صفحه‌ی موفقیت هدایت می‌شود
    const target = new URL('/payment/result', baseUrl);
    target.searchParams.set('status', 'success');
    target.searchParams.set('order', orderNumber);
    target.searchParams.set('tracking', order.trackingCode);
    return NextResponse.redirect(target, { status: 303 });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'CALLBACK_RECEIVED' },
  });

  if (!parsed.userReportedSuccess) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', errorMessage: 'پرداخت توسط کاربر لغو شد یا ناموفق بود' },
    });
    await cancelOrder(order.id, 'پرداخت ناموفق یا لغو شده توسط کاربر');
    return failRedirect('canceled', orderNumber);
  }

  try {
    const verification = await configured.verifyPayment({
      authority,
      amountToman: order.total,
      orderId: order.id,
      orderNumber,
    });

    if (!verification.ok) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          errorMessage: verification.message ?? 'تأیید تراکنش ناموفق بود',
          verifyPayload: verification.raw as never,
        },
      });
      await cancelOrder(order.id, 'تأیید تراکنش ناموفق بود');
      await writeAudit({
        action: 'PAYMENT_FAILED',
        entity: 'Order',
        entityId: order.id,
        after: { code: verification.code, message: verification.message },
      });
      return failRedirect('verify_failed', orderNumber);
    }

    const result = await finalizePaidOrder(orderNumber, {
      gateway: configured.name,
      authority,
      refId: verification.refId,
      cardPan: verification.cardPan,
      raw: verification.raw,
    });

    const target = new URL('/payment/result', baseUrl);
    target.searchParams.set('status', 'success');
    target.searchParams.set('order', result.order.orderNumber);
    target.searchParams.set('tracking', result.order.trackingCode);
    return NextResponse.redirect(target, { status: 303 });
  } catch (error) {
    console.error('[payment-callback] verification error:', error);
    await writeAudit({
      action: 'PAYMENT_ERROR',
      entity: 'Order',
      entityId: order.id,
      after: { message: error instanceof Error ? error.message : 'unknown' },
    });
    return failRedirect('error', orderNumber);
  }
}

export async function GET(request: Request, ctx: { params: { gateway: string } }) {
  return handle(request, ctx.params.gateway);
}

export async function POST(request: Request, ctx: { params: { gateway: string } }) {
  return handle(request, ctx.params.gateway);
}
