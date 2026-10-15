import {
  fetchJson,
  pick,
  readCallbackBody,
  tomanToRial,
  type ParsedCallback,
  type PaymentGatewayAdapter,
  type PaymentRequestInput,
  type PaymentRequestResult,
  type PaymentVerifyInput,
  type PaymentVerifyResult,
} from './types';

/**
 * آیدی‌پی — وب‌سرویس نسخه ۱.۱
 * مبلغ به ریال ارسال می‌شود. برای سندباکس هدر X-SANDBOX: 1 لازم است.
 */
export interface IDPayConfig {
  apiKey: string;
  sandbox?: boolean;
}

const BASE = 'https://api.idpay.ir/v1.1';

/** وضعیت‌های موفق: ۱۰۰ تأیید شد، ۱۰۱ قبلاً تأیید شده، ۲۰۰ پرداخت‌شده/تسویه‌شده */
const SUCCESS_STATUSES = new Set([100, 101, 200]);

export function createIDPayGateway(config: IDPayConfig): PaymentGatewayAdapter {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-API-KEY': config.apiKey,
  };
  if (config.sandbox) headers['X-SANDBOX'] = '1';

  return {
    name: 'IDPAY',

    async requestPayment(input: PaymentRequestInput): Promise<PaymentRequestResult> {
      if (!config.apiKey) throw new Error('کلید API آیدی‌پی تنظیم نشده است');
      const { status, body } = await fetchJson(`${BASE}/payment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          order_id: input.orderNumber,
          amount: Number(tomanToRial(input.amountToman)),
          callback: input.callbackUrl,
          phone: input.mobile ?? undefined,
          mail: input.email ?? undefined,
          desc: input.description,
        }),
      });

      const payload = body as { id?: string; link?: string; error_code?: number; error_message?: string };
      if (!payload?.id || !payload?.link) {
        throw new Error(
          `خطا در ایجاد تراکنش آیدی‌پی (HTTP ${status}): ${payload?.error_message ?? JSON.stringify(body)}`,
        );
      }
      return { authority: payload.id, redirectUrl: payload.link, raw: body };
    },

    async verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
      const { body } = await fetchJson(`${BASE}/payment/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: input.authority, order_id: input.orderNumber }),
      });
      const payload = body as {
        status?: number;
        track_id?: number | string;
        payment?: { card_no?: string; hashed_card_no?: string };
        error_message?: string;
        error_code?: number;
      };
      const status = payload?.status;
      const ok = typeof status === 'number' && SUCCESS_STATUSES.has(status);
      return {
        ok,
        refId: payload?.track_id !== undefined ? String(payload.track_id) : undefined,
        cardPan: payload?.payment?.card_no ?? undefined,
        code: status !== undefined ? String(status) : undefined,
        message: ok ? 'پرداخت با موفقیت تأیید شد' : payload?.error_message ?? 'تأیید تراکنش ناموفق بود',
        raw: body,
      };
    },

    async parseCallback(request: Request): Promise<ParsedCallback> {
      const body = await readCallbackBody(request);
      const authority = pick(body, 'id', 'ID');
      const status = pick(body, 'status');
      return {
        authority,
        userReportedSuccess: status === '10' || status === '100' || status === '101' || status === '200',
        payload: body,
      };
    },
  };
}
