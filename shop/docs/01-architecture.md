# ۰۱ — معماری و انتخاب استک

## ۱. چرا این استک؟

| لایه | انتخاب | دلیل |
|---|---|---|
| فرانت‌اند | **Next.js 14 (App Router) + TypeScript + Tailwind + Radix/shadcn** | رندر سمت سرور برای SEO محصولات، RTL بومی، کامپوننت‌های دسترسی‌پذیر |
| بک‌اند | **Next.js Route Handlers** (نه NestJS) | یک استقرار واحد، تایپ‌های مشترک با فرانت، حذف لایه‌ی شبکه‌ی اضافی. برای مقیاس بزرگ می‌توان سرویس‌ها را جدا کرد چون منطق در `src/lib/services` جدا شده است. |
| دیتابیس | **PostgreSQL 16 + Prisma 5** | تراکنش ACID برای رزرو اتمی شماره، ایندکس‌گذاری پیشرفته، JSONB برای payload درگاه |
| کش/نرخ | **Redis (ioredis) — اختیاری** | در نبود Redis، به‌صورت خودکار روی حافظه‌ی محلی fallback می‌کند (تک‌سرور) |
| احراز هویت | **JWT امضاشده با `jose` در کوکی HttpOnly + CSRF دو‌سویه** | بدون وابستگی به سرویس بیرونی |
| پرداخت | زرین‌پال / آیدی‌پی / نکست‌پی (آداپتر یکسان) | درگاه‌های ایرانی |
| پیامک | کاوه‌نگار / ملی‌پیامک | سرویس‌های ایرانی با لاگ کامل |
| اکسل | **exceljs** | تولید قالب و پارس فایل با استریم |

## ۲. لایه‌بندی

```
HTTP Request
  └─ middleware.ts            ← گارد مسیرهای /admin و /reseller، CSP، هدرهای امنیتی
      └─ src/app/api/**/route.ts   ← لایه‌ی نازک: CSRF، rate-limit، اعتبارسنجی zod
          └─ src/lib/services/*.ts ← منطق کسب‌وکار خالص + تراکنش دیتابیس
              └─ src/lib/prisma.ts ← کلاینت Prisma (singleton)
                  └─ PostgreSQL
```

قواعد معماری:

- **Route handler هیچ منطق کسب‌وکاری ندارد**؛ فقط `readJson` (zod)، `assertCsrf`، کنترل دسترسی و صدا زدن سرویس.
- **سرویس‌ها قابل تست خالص‌اند** (ورودی/خروجی مشخص) و تنها نقطه‌ی دسترسی به دیتابیس.
- **هیچ‌گاه به داده‌ی بازگشتی از درگاه اعتماد نمی‌کنیم**؛ همیشه `verify` سرور‌به‌سرور.
- **پول با `BigInt` (تومان)**، هرگز `number` اعشاری → در `src/lib/utils/money.ts`.
- **تاریخ‌ها** با `jalaali-js` به شمسی تبدیل می‌شوند (`src/lib/utils/jalali.ts`).

## ۳. جریان یک خرید (Happy Path)

```
۱. GET  /api/auth/csrf                 → توکن CSRF (کوکی + بدنه)
۲. POST /api/cart/items                → افزودن شماره/مودم/کد فعال‌سازی
۳. POST /api/checkout                  → order.service.createOrderAndPayment()
     ├─ تراکنش DB: ساخت Order + رزرو اتمی شماره‌ها + OrderItem
     ├─ فراخوانی requestPayment درگاه → دریافت authority + redirectUrl
     └─ ثبت Payment (INITIATED)
۴. کاربر به درگاه می‌رود و بازمی‌گردد به:
   GET/POST /api/payment/callback/[gateway]
     ├─ پیدا کردن Payment با authority
     ├─ verify سرور‌به‌سرور با درگاه
     ├─ order.service.finalizePaidOrder()  ← idempotent
     │    ├─ شماره → SOLD ، کاهش موجودی مودم ، واریز کمیسیون نماینده
     │    ├─ Order → PROCESSING یا AWAITING_PHYSICAL_DELIVERY
     │    └─ SMS به ادمین و مشتری (با لاگ)
     └─ ریدایرکت ۳۰۳ به /payment/result?status=success
```

در صورت خطای درگاه، `createOrderAndPayment` رزرو را آزاد و سفارش را `FAILED` می‌کند
(تراکنش جبران — به `src/lib/services/order.service.ts` نگاه کنید).

## ۴. مقیاس‌پذیری

- **رزرو اتمی** با `updateMany` شرطی، نه «خواندن سپس نوشتن» → مقاوم در برابر race condition.
- **تسویه‌ی idempotent**: callback تکراری باعث فروش مجدد نمی‌شود (تست شده).
- **cache-first** برای تنظیمات عمومی (TTL ۶۰/۱۲۰ ثانیه) و کاهش فشار روی DB.
- **ایندکس‌های ترکیبی** روی فیلدهای پر‌کوئری (وضعیت، اپراتور، قیمت، پیش‌شماره، پسوند).
- افقی: افزودن replica خواندنی + Redis مشترک؛ عمودی: `DATABASE_URL` به pooler.
- Cron نگهداری: `/api/cron/maintenance` (آزادسازی رزروهای منقضی، پاک‌سازی سبدها) با `CRON_SECRET`.

## ۵. نقشه‌ی پوشه‌ها

```
src/
├── app/
│   ├── (فروشگاه)  /  about  contact  faq  privacy  terms
│   ├── phones/ modems/ activation/           ← کاتالوگ و جزئیات
│   ├── cart/ checkout/ payment/result/       ← خرید
│   ├── login/ register/ track/               ← حساب و پیگیری
│   ├── reseller/  (پنل نمایندگان)
│   ├── admin/     (پنل مدیریت)
│   └── api/       (Route Handlers)
├── components/  site | dashboard | reseller | admin | ui
└── lib/
    ├── auth/        jwt · password · rbac · session · totp
    ├── services/    product · cart · order · phone · modem · reseller · admin…
    ├── payments/    types · zarinpal · idpay · nextpay · index
    ├── sms/         types · kavenegar · melipayamak · templates · index
    ├── excel/       schema · template · parser · import.service
    ├── filters/     phone-filter · operator-detect · pattern
    ├── validation/  auth · common · product
    ├── utils/       money · jalali · ids · pattern · persian · http
    └── settings · csrf · rate-limit · audit · cache · errors · api
```

## ۶. تصمیمات کلیدی و دلیل

1. **یک اپ Next.js به‌جای جدا کردن بک‌اند:** حمل‌ونقل تایپ‌های zod از سرور به کلاینت بدون تولید SDK.
2. **JWT در کوکی HttpOnly + CSRF دو‌سویه:** مقاوم در برابر XSS (کوکی HttpOnly) و CSRF (توکن double-submit).
3. **کلیدهای درگاه/پیامک در جدول `Setting` از نوع `SECRET`:** قابل تغییر از پنل، ماسک‌شده در API، بدون نیاز به ری‌استارت.
4. **کد فعال‌سازی با قیمت پله‌ای:** جدول `ActivationCodePrice` با بازه‌ی تعداد → تابع خالص `quoteActivation` قابل تست.
5. **تحلیل خودکار زیبایی شماره در زمان ثبت:** فیلدهای `isRond/isSequential/isRepeated/isPalindrome/rondScore` ذخیره می‌شوند تا فیلتر سریع باشد.
