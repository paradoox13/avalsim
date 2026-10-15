# ۰۷ — درگاه پرداخت و پیامک ایرانی

## ۱. معماری آداپتر درگاه

همه‌ی درگاه‌ها یک قرارداد واحد را پیاده می‌کنند (`src/lib/payments/types.ts`):

```ts
interface PaymentGatewayAdapter {
  readonly name: 'ZARINPAL' | 'IDPAY' | 'NEXTPAY';
  requestPayment(i: PaymentRequestInput): Promise<PaymentRequestResult>; // → { authority, redirectUrl, raw }
  verifyPayment(i: PaymentVerifyInput): Promise<PaymentVerifyResult>;    // → { ok, refId, cardPan, raw }
  parseCallback(request: Request): Promise<ParsedCallback>;              // query / form / json
}
```

- **مبلغ در تمام سیستم به تومان است** و هر آداپتور خودش به ریال تبدیل می‌کند (`tomanToRial`, هر تومان ۱۰ ریال).
- انتخاب درگاه از تنظیم `payment.activeGateway` خوانده می‌شود → `getPaymentGateway()`.
- `parseCallback` هر سه شکل بدنه را می‌خواند: query string، `application/x-www-form-urlencoded` و JSON.
- **هیچ‌گاه به `status` بازگشتی از درگاه اعتماد نمی‌کنیم**؛ «موفق» فقط پس از `verify` سرور‌به‌سرور پذیرفته می‌شود.

### ۱.۱ زرین‌پال (نسخه ۴)
| مرحله | Endpoint |
|---|---|
| درخواست | `POST https://payment.zarinpal.com/pg/v4/payment/request.json` |
| هدایت | `https://payment.zarinpal.com/pg/StartPay/{authority}` |
| تأیید | `POST https://payment.zarinpal.com/pg/v4/payment/verify.json` |
| سندباکس | `https://sandbox.zarinpal.com/pg/...` |
پاسخ موفق: `data.code = 100` (تأیید) یا `101` (قبلاً تأییدشده) و `data.ref_id`.
تنظیم مربوطه: `payment.zarinpal.merchantId`.

### ۱.۲ آیدی‌پی (نسخه ۱.۱)
| مرحله | Endpoint |
|---|---|
| درخواست | `POST https://api.idpay.ir/v1.1/payment` (هدر `X-API-KEY`، سندباکس: `X-SANDBOX: 1`) |
| هدایت | فیلد `link` در پاسخ |
| تأیید | `POST https://api.idpay.ir/v1.1/payment/verify` |
پاسخ موفق: `status ∈ {100, 101, 200}` و `track_id` به‌عنوان شماره‌ی پیگیری.
تنظیمات: `payment.idpay.apiKey` (+ کلید سندباکس عمومی در `payment.idpay.sandboxKey`).

### ۱.۳ نکست‌پی
| مرحله | Endpoint |
|---|---|
| درخواست | `POST https://nextpay.org/nx/gateway/token` |
| هدایت | `https://nextpay.org/nx/gateway/payment/{trans_id}` |
| تأیید | `POST https://nextpay.org/nx/gateway/verify` |
تنظیم: `payment.nextpay.apiKey`.

## ۲. جریان پرداخت و امنیت

1. `POST /api/checkout` → اعتبارسنجی سبد + تراکنش: ساخت `Order` + **رزرو اتمی** شماره‌ها + `OrderItem`.
2. فراخوانی `requestPayment` → ثبت `Payment` با `status = INITIATED` و `authority` یکتا.
3. کاربر در درگاه پرداخت می‌کند و به `callbackUrl` برمی‌گردد:
   `/api/payment/callback/{gateway}?order={orderNumber}`
4. callback: بازیابی `Payment` از `authority` → `verify` سرور‌به‌سرور → `finalizePaidOrder()`.
5. `finalizePaidOrder` **idempotent** است: اجرای دوباره فروش مجدد یا واریز مضاعف نمی‌کند.
6. روی خطا: `cancelOrder` + آزادسازی رزرو + ثبت `AuditLog`.

> **آدرس بازگشت:** از `payment.callbackBaseUrl` خوانده می‌شود؛ در نبود آن از `NEXT_PUBLIC_APP_URL`. دقت کنید مقدار با دامنه‌ی ساب‌دامین نهایی یکسان باشد، وگرنه درگاه callback را رد می‌کند.

## ۳. سرویس پیامک

قرارداد واحد در `src/lib/sms/types.ts`؛ Provider از `sms.provider` انتخاب می‌شود.

### ۳.۱ کاوه‌نگار
- پایه: `https://api.kavenegar.com/v1/{API-KEY}`
- ارسال ساده: `POST /sms/send.json` با پارامترهای `sender`, `receptor`, `message`.
- قالبی (Lookup): `POST /verify/lookup.json` با `receptor`, `token`, `template`.
- پاسخ: کنسول `return { status, message }` + آرایه‌ی `entries[]` شامل `messageid`, `status`, `statustext`, `cost`.
- تنظیمات: `sms.kavenegar.apiKey`، `sms.kavenegar.sender`.

### ۳.۲ ملی‌پیامک
- پایه: `https://rest.payamak-panel.com/api/SendSMS`
- ارسال ساده: `SendSms` با `username`, `password`, `to`, `from`, `text`, `isflash`.
- پاسخ: `Value` (شناسه‌ی ارسال) یا پیام خطای عددی.
- تنظیمات: `sms.melipayamak.username`، `sms.melipayamak.password`، `sms.melipayamak.sender`.

## ۴. قواعد ارسال و لاگ‌گیری

- **هیچ خطای پیامک نباید خرید را متوقف کند** → `notification.service.sendSms` تمام خطاها را می‌گیرد.
- هر ارسال **قبل** از فراخوانی Provider در `SmsLog` با `status = QUEUED` ثبت می‌شود و سپس به `SENT`/`FAILED` به‌روزرسانی می‌گردد (بدون گم‌شدن رکورد حتی در قطعی شبکه).
- رخدادهای پیامکی:
  - خرید کد فعال‌سازی یا محصول فیزیکی → پیامک به ادمین‌ها (`sms.adminMobiles`).
  - پرداخت موفق → پیامک تأیید با کد رهگیری به مشتری.
  - تغییر وضعیت سفارش (ارسال/تحویل) → پیامک به مشتری.
  - کد یک‌بار‌مصرف ورود (OTP) → پیامک به کاربر.
- قالب‌های پیام در `src/lib/sms/templates.ts` با متغیرهای قابل جایگذاری؛ قابل ویرایش از پنل ادمین.
- پنل ادمین → «پیامک» تمام لاگ‌ها را با وضعیت و هزینه نشان می‌دهد و امکان ارسال دستی دارد.

## ۵. تله‌متری و پایداری

- `fetchJson` برای همه‌ی فراخوانی‌های بیرونی از `AbortSignal.timeout(15s)` استفاده می‌کند تا کندی درگاه باعث شکست سرور نشود.
- پاسخ کامل درگاه (`raw`) در ستون `Json` ذخیره می‌شود؛ برای رفع اختلاف با درگاه در پنل ادمین قابل مشاهده است.
