import {
  fetchJson,
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
 * نکست‌پی
 * مستندات: https://nextpay.org/nx/docs
 * نکته: مبلغ پیش‌فرض این درگاه تومان است؛ برای صراحت، currency=IRT می‌فرستیم.
 * کد موفقیت ساخت توکن: -1 — کد موفقیت تأیید: 0
 * سندباکس در این نسخه مستند نشده است؛ بنابراین فقط حالت واقعی پشتیبانی می‌شود.
 */
export interface NextPayConfig {
  apiKey: string;
}

const TOKEN_URL = 'https://nextpay.org/nx/gateway/token';
const VERIFY_URL = 'https://nextpay.org/nx/gateway/verify';
const PAYMENT_URL = 'https://nextpay.org/nx/gateway/payment';

export function createNextPayGateway(config: NextPayConfig): PaymentGatewayAdapter {
  return {
    name: 'NEXTPAY',

    async requestPayment(input: PaymentRequestInput): Promise<PaymentRequestResult> {
      if (!config.apiKey) throw new Error('کلید API نکست‌پی تنظیم نشده است');
      const form = new URLSearchParams({
        api_key: config.apiKey,
        order_id: input.orderNumber,
        amount: input.amountToman.toString(),
        currency: 'IRT',
        callback_uri: input.callbackUrl,
        payer_desc: input.description,
      });
      if (input.mobile) form.set('customer_phone', input.mobile);
      // auto_verify=false → تأیید دستی سرور به سرور انجام می‌شود (امن‌تر)
      form.set('auto_verify', 'false');

      const { status, body } = await fetchJson(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      const payload = body as { code?: number; trans_id?: number | string };
      if (payload?.code !== -1 || payload?.trans_id === undefined) {
        throw new Error(`خطا در ایجاد تراکنش نکست‌پی (HTTP ${status}): ${JSON.stringify(body)}`);
      }
      return {
        authority: String(payload.trans_id),
        redirectUrl: `${PAYMENT_URL}/${payload.trans_id}`,
        raw: body,
      };
    },

    async verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult> {
      const form = new URLSearchParams({
        api_key: config.apiKey,
        trans_id: input.authority,
        amount: input.amountToman.toString(),
        currency: 'IRT',
      });
      const { body } = await fetchJson(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const payload = body as {
        code?: number;
        Shaparak_Ref_Id?: string;
        card_holder?: string;
      };
      const ok = payload?.code === 0;
      return {
        ok,
        refId: payload?.Shaparak_Ref_Id ?? undefined,
        cardPan: payload?.card_holder ?? undefined,
        code: payload?.code !== undefined ? String(payload.code) : undefined,
        message: ok ? 'پرداخت با موفقیت تأیید شد' : 'تأیید تراکنش ناموفق بود',
        raw: body,
      };
    },

    async parseCallback(request: Request): Promise<ParsedCallback> {
      const body = await readCallbackBody(request);
      const transId = body.trans_id ?? body.transId ?? null;
      // نکست‌پی در callback وضعیت موفقیت نمی‌فرستد؛ تأیید فقط سرور به سرور انجام می‌شود.
      return { authority: transId, userReportedSuccess: Boolean(transId), payload: body };
    },
  };
}

export { tomanToRial };
