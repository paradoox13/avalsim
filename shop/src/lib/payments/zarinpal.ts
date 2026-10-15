import {
  fetchJson,
  pick,
  tomanToRial,
  type ParsedCallback,
  type PaymentGatewayAdapter,
  type PaymentRequestInput,
  type PaymentRequestResult,
  type PaymentVerifyInput,
  type PaymentVerifyResult,
} from './types';

/**
 * زرین‌پال — درگاه پرداخت نسخه ۴
 * مستندات: https://www.zarinpal.com/docs/paymentGateway/connectToGateway
 * مبلغ به ریال ارسال می‌شود (currency = IRR).
 */
export interface ZarinPalConfig {
  merchantId: string;
  sandbox?: boolean;
}

const LIVE = {
  request: 'https://payment.zarinpal.com/pg/v4/payment/request.json',
  verify: 'https://payment.zarinpal.com/pg/v4/payment/verify.json',
  startPay: 'https://payment.zarinpal.com/pg/StartPay',
};

const SANDBOX = {
  request: 'https://sandbox.zarinpal.com/pg/v4/payment/request.json',
  verify: 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json',
  startPay: 'https://sandbox.zarinpal.com/pg/StartPay',
};

/** کدهای موفقیت زرین‌پال: ۱۰۰ = تأیید شد، ۱۰۱ = قبلاً تأیید شده */
const SUCCESS_CODES = new Set([100, 101]);

export function createZarinPalGateway(config: ZarinPalConfig): PaymentGatewayAdapter {
  const urls = config.sandbox ? SANDBOX : LIVE;

  return {
    name: 'ZARINPAL',

    async requestPayment(input: PaymentRequestInput): Promise<PaymentRequestResult> {
      if (!config.merchantId) throw new Error('شناسه پذیرنده زرین‌پال تنظیم نشده است');
      const { status, body } = await fetchJson(urls.request, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          merchant_id: config.merchantId,
          amount: Number(tomanToRial(input.amountToman)),
          currency: 'IRR',
          description: input.description,
          callback_url: input.callbackUrl,
          metadata: {
            mobile: input.mobile ?? undefined,
            email: input.email ?? undefined,
            order_id: input.orderNumber,
          },
        }),
      });

      const payload = body as { data?: { authority?: string; code?: number; message?: string }; errors?: unknown };
      const authority = payload?.data?.authority;
      if (!authority) {
        throw new Error(
          `خطا در ایجاد تراکنش زرین‌پال (HTTP ${status}): ${JSON.stringify(payload?.errors ?? payload?.data ?? body)}`,
        );
      }
      return { authority, redirectUrl: `${urls.startPay}/${authority}`, raw: body };
    },

    async verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
      const { body } = await fetchJson(urls.verify, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          merchant_id: config.merchantId,
          amount: Number(tomanToRial(input.amountToman)),
          authority: input.authority,
        }),
      });
      const payload = body as {
        data?: { code?: number; ref_id?: number | string; card_pan?: string; message?: string };
        errors?: { code?: number; message?: string } | Array<{ code?: number; message?: string }>;
      };
      const code = payload?.data?.code;
      const ok = typeof code === 'number' && SUCCESS_CODES.has(code);
      const errorMessage =
        !ok && payload?.errors
          ? JSON.stringify(payload.errors)
          : payload?.data?.message ?? 'تأیید تراکنش ناموفق بود';
      return {
        ok,
        refId: payload?.data?.ref_id !== undefined ? String(payload.data.ref_id) : undefined,
        cardPan: payload?.data?.card_pan ?? undefined,
        code: code !== undefined ? String(code) : undefined,
        message: ok ? 'پرداخت با موفقیت تأیید شد' : errorMessage,
        raw: body,
      };
    },

    async parseCallback(request: Request): Promise<ParsedCallback> {
      const url = new URL(request.url);
      const authority = url.searchParams.get('Authority') ?? url.searchParams.get('authority');
      const status = (url.searchParams.get('Status') ?? url.searchParams.get('status') ?? '').toUpperCase();
      return {
        authority,
        userReportedSuccess: status === 'OK',
        payload: Object.fromEntries(url.searchParams.entries()),
      };
    },
  };
}

export { pick };
