import { fetchJson } from '../utils/http';

export { fetchJson };

export type GatewayName = 'ZARINPAL' | 'IDPAY' | 'NEXTPAY';

export interface PaymentRequestInput {
  /** مبلغ به تومان (تبدیل به ریال در هر آداپتور انجام می‌شود) */
  amountToman: bigint;
  /** شناسه‌ی داخلی سفارش (cuid) — برای درگاه‌هایی که به شناسه‌ی رشته‌ای نیاز دارند */
  orderId: string;
  /** شماره‌ی قابل‌خواندن سفارش: SH-14030812-000123 */
  orderNumber: string;
  description: string;
  callbackUrl: string;
  mobile?: string;
  email?: string;
}

export interface PaymentRequestResult {
  /** شناسه‌ی تراکنش نزد درگاه (Authority/token/id) */
  authority: string;
  /** آدرسی که کاربر باید به آن هدایت شود */
  redirectUrl: string;
  raw: unknown;
}

export interface PaymentVerifyInput {
  authority: string;
  amountToman: bigint;
  orderId: string;
  orderNumber: string;
}

export interface PaymentVerifyResult {
  ok: boolean;
  refId?: string;
  cardPan?: string;
  code?: string;
  message?: string;
  raw: unknown;
}

export interface ParsedCallback {
  /** شناسه‌ی تراکنش بازگشتی از درگاه */
  authority: string | null;
  /** آیا کاربر/درگاه تراکنش را موفق اعلام کرده است؟ (تأیید نهایی فقط با verify) */
  userReportedSuccess: boolean;
  payload: Record<string, string>;
}

export interface PaymentGatewayAdapter {
  readonly name: GatewayName;
  requestPayment(input: PaymentRequestInput): Promise<PaymentRequestResult>;
  verifyPayment(input: PaymentVerifyInput): Promise<PaymentVerifyResult>;
  parseCallback(request: Request): Promise<ParsedCallback>;
}

/** تومان → ریال (هر تومان ۱۰ ریال) */
export function tomanToRial(amount: bigint): bigint {
  return amount * 10n;
}

/** خواندن بدنه‌ی callback که می‌تواند JSON، form-encoded یا query باشد */
export async function readCallbackBody(request: Request): Promise<Record<string, string>> {
  const url = new URL(request.url);
  const result: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });

  if (request.method === 'POST' || request.method === 'PUT') {
    const raw = await request.text();
    if (raw) {
      const contentType = request.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        try {
          const json = JSON.parse(raw) as Record<string, unknown>;
          for (const [key, value] of Object.entries(json)) {
            if (value !== null && value !== undefined && typeof value !== 'object') {
              result[key] = String(value);
            }
          }
        } catch {
          /* ignore */
        }
      } else {
        for (const [key, value] of new URLSearchParams(raw)) result[key] = value;
      }
    }
  }
  return result;
}

/** جست‌وجوی کلید بدون حساسیت به بزرگی/کوچکی حروف (درگاه‌ها در نام‌گذاری ناهماهنگ‌اند) */
export function pick(body: Record<string, string>, ...keys: string[]): string | null {
  const lower = new Map(Object.keys(body).map((k) => [k.toLowerCase(), body[k]]));
  for (const key of keys) {
    const value = lower.get(key.toLowerCase());
    if (value !== undefined && value !== '') return value;
  }
  return null;
}
