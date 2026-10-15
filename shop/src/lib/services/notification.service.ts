import { prisma } from '../prisma';
import { getSmsProvider, getAdminMobiles } from '../sms';
import { adminNewOrderMessage, orderPaidMessage, orderStatusMessage, otpMessage, SMS_TEMPLATES, renderTemplate } from '../sms/templates';
import { formatToman } from '../utils/money';

export interface SendSmsOptions {
  mobile: string;
  message: string;
  template?: string;
  tokens?: string[];
  userId?: string | null;
  orderId?: string | null;
  /** برچسب داخلی برای پیگیری در پنل ادمین */
  label?: string;
}

/**
 * ارسال پیامک با ثبت کامل لاگ.
 * هیچ خطای ارسال پیامک نباید فرآیند خرید را متوقف کند؛ بنابراین خطاها فقط لاگ می‌شوند.
 */
export async function sendSms(options: SendSmsOptions): Promise<{ ok: boolean; id: string }> {
  const log = await prisma.smsLog.create({
    data: {
      userId: options.userId ?? null,
      orderId: options.orderId ?? null,
      mobile: options.mobile,
      message: options.message,
      template: options.label ?? options.template ?? null,
      provider: 'NONE',
      status: 'QUEUED',
    },
  });

  try {
    const provider = await getSmsProvider();
    if (!provider) {
      await prisma.smsLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', errorMessage: 'سرویس پیامک تنظیم نشده یا غیرفعال است' },
      });
      return { ok: false, id: log.id };
    }

    const result = await provider.send({
      mobile: options.mobile,
      message: options.message,
      template: options.template,
      tokens: options.tokens,
    });

    await prisma.smsLog.update({
      where: { id: log.id },
      data: {
        provider: provider.name,
        status: result.ok ? 'SENT' : 'FAILED',
        providerMessageId: result.providerMessageId ?? null,
        cost: result.cost ?? null,
        response: (result.raw ?? undefined) as never,
        errorMessage: result.errorMessage ?? null,
        sentAt: result.ok ? new Date() : null,
      },
    });
    return { ok: result.ok, id: log.id };
  } catch (error) {
    await prisma.smsLog
      .update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'خطای نامشخص',
        },
      })
      .catch(() => undefined);
    return { ok: false, id: log.id };
  }
}

/** اطلاع‌رسانی به ادمین‌ها هنگام نیاز به ارسال فیزیکی */
export async function notifyAdminsOfNewOrder(order: {
  id: string;
  orderNumber: string;
  total: bigint;
  customerName: string;
  requiresPhysicalDelivery: boolean;
}): Promise<void> {
  const mobiles = await getAdminMobiles();
  if (!mobiles.length) return;
  const typeLabel = order.requiresPhysicalDelivery ? 'کد فعال‌سازی / مودم (ارسال فیزیکی)' : 'شماره سیم‌کارت';
  const message = adminNewOrderMessage({
    orderNumber: order.orderNumber,
    total: order.total,
    customerName: order.customerName,
    typeLabel,
  });
  await Promise.all(
    mobiles.map((mobile) =>
      sendSms({ mobile, message, orderId: order.id, label: 'admin_new_order' }),
    ),
  );
}

/** پیامک تأیید خرید برای مشتری */
export async function notifyCustomerOrderPaid(order: {
  id: string;
  customerName: string;
  customerPhone: string;
  orderNumber: string;
  total: bigint;
  trackingCode: string;
  userId?: string | null;
}): Promise<void> {
  await sendSms({
    mobile: order.customerPhone,
    message: orderPaidMessage({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      total: order.total,
      trackingCode: order.trackingCode,
    }),
    orderId: order.id,
    userId: order.userId ?? null,
    label: 'customer_paid',
  });
}

/** اطلاع تغییر وضعیت سفارش */
export async function notifyOrderStatus(order: {
  id: string;
  customerPhone: string;
  orderNumber: string;
  status: string;
  trackingCode: string;
}): Promise<void> {
  await sendSms({
    mobile: order.customerPhone,
    message: orderStatusMessage({
      orderNumber: order.orderNumber,
      status: order.status,
      trackingCode: order.trackingCode,
    }),
    orderId: order.id,
    label: 'order_status',
  });
}

/** اطلاع فروش به نماینده */
export async function notifyResellerSale(input: {
  mobile: string;
  userId: string;
  amount: bigint;
  balance: bigint;
}): Promise<void> {
  await sendSms({
    mobile: input.mobile,
    userId: input.userId,
    message: renderTemplate(SMS_TEMPLATES.resellerSale, {
      amount: formatToman(input.amount, false),
      balance: formatToman(input.balance, false),
    }),
    label: 'reseller_sale',
  });
}

/** ارسال کد یک‌بارمصرف ورود */
export async function sendLoginOtp(mobile: string, code: string, userId?: string | null): Promise<void> {
  await sendSms({
    mobile,
    userId: userId ?? null,
    message: otpMessage(code),
    label: 'login_otp',
  });
}
