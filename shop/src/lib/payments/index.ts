import { getSettingBoolean, getSettingString } from '../settings';
import { paymentError } from '../errors';
import { createZarinPalGateway } from './zarinpal';
import { createIDPayGateway } from './idpay';
import { createNextPayGateway } from './nextpay';
import type { GatewayName, PaymentGatewayAdapter } from './types';

export * from './types';
export { createZarinPalGateway, createIDPayGateway, createNextPayGateway };

/**
 * ساخت آداپتور درگاه فعال بر اساس تنظیمات پنل ادمین.
 * کلیدهای درگاه در جدول Setting (نوع SECRET) ذخیره می‌شوند و هرگز به فرانت‌اند نمی‌روند.
 */
export async function getPaymentGateway(): Promise<PaymentGatewayAdapter> {
  const gateway = (await getSettingString('payment.activeGateway')) as GatewayName;
  const sandbox = await getSettingBoolean('payment.sandbox');

  switch (gateway) {
    case 'IDPAY': {
      const apiKey = await getSettingString('payment.idpay.apiKey');
      const fallback = sandbox ? await getSettingString('payment.idpay.sandboxKey') : '';
      return createIDPayGateway({ apiKey: apiKey || fallback, sandbox });
    }
    case 'NEXTPAY': {
      const apiKey = await getSettingString('payment.nextpay.apiKey');
      return createNextPayGateway({ apiKey });
    }
    case 'ZARINPAL':
    default: {
      const merchantId = await getSettingString('payment.zarinpal.merchantId');
      return createZarinPalGateway({ merchantId, sandbox });
    }
  }
}

/** تعیین آدرس بازگشت از درگاه: از تنظیمات، وگرنه از هدر درخواست */
export function resolveCallbackBaseUrl(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (request) {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') ?? 'https';
    if (host) return `${proto}://${host}`;
  }
  return 'http://localhost:3000';
}

export async function getConfiguredCallbackBaseUrl(request?: Request): Promise<string> {
  const fromSettings = await getSettingString('payment.callbackBaseUrl');
  if (fromSettings) return fromSettings.replace(/\/$/, '');
  return resolveCallbackBaseUrl(request);
}

export function assertGatewayConfigured(adapter: PaymentGatewayAdapter): void {
  if (!adapter) throw paymentError('درگاه پرداخت تنظیم نشده است');
}
