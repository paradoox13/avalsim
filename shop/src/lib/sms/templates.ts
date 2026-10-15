import { formatToman } from '../utils/money';
import { toPersianDigits } from '../utils/persian';

/**
 * الگوهای پیامک — همه‌ی متن‌ها از یک نقطه مدیریت می‌شوند.
 * محدودیت: پیامک فارسی باید کوتاه باشد (هر پیامک ۷۰ کاراکتر).
 */

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export const SMS_TEMPLATES = {
  /** اطلاع‌رسانی به ادمین: سفارش کد فعال‌سازی یا محصول فیزیکی در انتظار ارسال است */
  adminNewOrder:
    'سفارش جدید {{orderNumber}}\nمبلغ: {{total}} تومان\nمشتری: {{customerName}}\nنوع: {{type}}\nنیازمند ارسال فیزیکی',
  /** تأیید خرید برای مشتری */
  customerOrderPaid:
    '{{name}} عزیز، پرداخت سفارش {{orderNumber}} با موفقیت انجام شد.\nمبلغ: {{total}} تومان\nکد رهگیری: {{trackingCode}}',
  /** تغییر وضعیت سفارش */
  customerOrderStatus: 'سفارش {{orderNumber}} به وضعیت «{{status}}» تغییر یافت. کد رهگیری: {{trackingCode}}',
  /** کد تأیید ورود */
  loginOtp: 'کد ورود شما به {{site}}: {{code}}\nاین کد را در اختیار دیگران قرار ندهید.',
  /** تأیید ثبت‌نام نماینده */
  resellerWelcome:
    '{{name}} عزیز، ثبت‌نام نمایندگی شما با کد {{code}} دریافت شد و پس از بررسی فعال می‌شود.',
  /** اطلاع فروش به نماینده */
  resellerSale: 'یک محصول شما به مبلغ {{amount}} تومان فروخته شد. مانده قابل تسویه: {{balance}} تومان.',
  /** تسویه با نماینده */
  resellerSettlement: 'تسویه {{amount}} تومان انجام شد. کد پیگیری: {{code}}',
} as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'در انتظار پرداخت',
  PAID: 'پرداخت شده',
  PROCESSING: 'در حال آماده‌سازی',
  AWAITING_PHYSICAL_DELIVERY: 'در انتظار ارسال فیزیکی',
  SHIPPED: 'ارسال شده',
  DELIVERED: 'تحویل داده شده',
  CANCELED: 'لغو شده',
  REFUNDED: 'مرجوع شده',
  FAILED: 'ناموفق',
};

export function orderPaidMessage(order: {
  customerName: string;
  orderNumber: string;
  total: bigint;
  trackingCode: string;
}): string {
  return renderTemplate(SMS_TEMPLATES.customerOrderPaid, {
    name: order.customerName.split(' ')[0] ?? order.customerName,
    orderNumber: order.orderNumber,
    total: formatToman(order.total, false),
    trackingCode: order.trackingCode,
  });
}

export function orderStatusMessage(order: {
  orderNumber: string;
  status: string;
  trackingCode: string;
}): string {
  return renderTemplate(SMS_TEMPLATES.customerOrderStatus, {
    orderNumber: order.orderNumber,
    status: ORDER_STATUS_LABELS[order.status] ?? order.status,
    trackingCode: order.trackingCode,
  });
}

export function adminNewOrderMessage(order: {
  orderNumber: string;
  total: bigint;
  customerName: string;
  typeLabel: string;
}): string {
  return renderTemplate(SMS_TEMPLATES.adminNewOrder, {
    orderNumber: order.orderNumber,
    total: formatToman(order.total, false),
    customerName: order.customerName,
    type: order.typeLabel,
  });
}

export function otpMessage(code: string, siteName = 'سیم‌شاپ'): string {
  return renderTemplate(SMS_TEMPLATES.loginOtp, { site: siteName, code: toPersianDigits(code) });
}
