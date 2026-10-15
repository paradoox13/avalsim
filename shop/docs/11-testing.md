# ۱۱ — تست و اعتبارسنجی

## ۱. اجرای تست‌ها

```bash
npm install                # نصب وابستگی‌ها (حفظ package-lock.json)
npx prisma generate        # تولید کلاینت Prisma
npm test                   # فقط یونیت (بدون دیتابیس هم سبز است)

# با دیتابیس واقعی (تست‌های یکپارچه اجرا می‌شوند)
DATABASE_URL="postgresql://shop:shop@127.0.0.1:5432/shop?schema=public" npm test
```

پیکربندی: `vitest.config.ts` (محیط node، `tests/**/*.test.ts`، `setupFiles: tests/setup.ts`).
تست‌های یکپارچه اگر `DATABASE_URL` نباشد، به‌صورت خودکار `describe.skip` می‌شوند تا CI سبز بماند.
تست‌های کامپوننت با کامنت `// @vitest-environment jsdom` در بالای فایل، محیط خود را به jsdom تغییر می‌دهند
(وابستگی توسعه: `jsdom`)؛ `esbuild.jsx = 'automatic'` در `vitest.config.ts` اجازه‌ی رندر JSX بدون import React را می‌دهد.

## ۲. فایل‌های تست

### یونیت (منطق خالص، بدون دیتابیس)
| فایل | پوشش |
|---|---|
| `tests/unit/money.test.ts` | محاسبات `BigInt`، تبدیل تومان/ریال، درصدها |
| `tests/unit/jalali.test.ts` | تبدیل تاریخ میلادی↔شمسی، فرمت‌های نمایش |
| `tests/unit/persian.test.ts` | ارقام فارسی، نرمال‌سازی متن، نیم‌فاصله |
| `tests/unit/pattern.test.ts` | تحلیل رند/متوالی/تکراری/آینه و `rondScore` |
| `tests/unit/operator.test.ts` | تشخیص اپراتور از پیش‌شماره |
| `tests/unit/phone-filter.test.ts` | ساخت کوئری فیلتر پیشرفته (الگو، بازه، مرتب‌سازی) |
| `tests/unit/pricing.test.ts` | قیمت پله‌ای کد فعال‌سازی |
| `tests/unit/jwt.test.ts` | امضا/verify نشست، انقضا، دستکاری |
| `tests/unit/rbac.test.ts` | ماتریس نقش→دسترسی، `can/isAdmin/isReseller` |
| `tests/unit/validation.test.ts` | اسکیمای zod، کد ملی ایران، موبایل |
| `tests/unit/excel.test.ts` | قالب اکسل، نگاشت سرستون‌ها، نرمال‌سازی، رد تکراری |

### کامپوننت (jsdom)
| فایل | پوشش |
|---|---|
| `tests/components/phone-browser.test.ts` | قرارداد پاسخ `/api/products/phones`: رندر کارت‌ها از آرایه‌ی `data` (نه `data.items`)، خواندن `total` از `meta`، و مصون‌بودن رندر در برابر پاسخ بدون آرایه |

### یکپارچه (PostgreSQL واقعی)
| فایل | پوشش |
|---|---|
| `tests/integration/checkout.test.ts` | رزرو هم‌زمان، تسویه‌ی موفق، **idempotency**، کاهش موجودی مودم، سفارش کد فعال‌سازی (انتظار ارسال فیزیکی)، آزادسازی رزرو منقضی |
| `tests/integration/payment-flow.test.ts` | چرخه‌ی کامل پرداخت از طریق **route handler واقعی درگاه**: ساخت سفارش → `Payment INITIATED` → callback → verify سرور‌به‌سرور → تسویه‌ی نهایی → callback تکراری → callback نامعتبر |

## ۳. نتیجه‌ی اجرای واقعی (این محیط)

```
Test Files  14 passed (14)
     Tests  100 passed (100)
```
دو بار پشت‌سرهم اجرا شد و هر دو بار ۱۰۰/۱۰۰ سبز بود (تست idempotent و قابل تکرار).
عدد ۱۰۰ = ۸۵ یونیت + ۲ کامپوننت + ۱۳ یکپارچه.

> نکته‌ی رفع اشکال واقعی: تست یکپارچه‌ی پرداخت در اجرای دوم به‌دلیل باقی‌ماندن یک شماره‌ی تستی (خارج از لیست پاک‌سازی) روی قید یکتای `msisdn` خطا می‌داد. شماره به `TEST_PHONES` افزوده شد و مجموعه اکنون **چندبار‌اجرا (repeatable)** است.

> نکته‌ی رفع اشکال واقعی (فقط-client-side): مرورگر شماره‌ها پاسخ `/api/products/phones` را
> به‌شکل `data.items` می‌خواند، در حالی که این اندپوینت `data` را **آرایه‌ی مستقیم** برمی‌گرداند.
> نتیجه `items = undefined` می‌شد و رندر کل صفحه با
> `TypeError: Cannot read properties of undefined (reading 'length')` سفید می‌رفت — چون SSR فقط
> اسکلتون بارگذاری را می‌کشد، نه تست‌های HTTP و نه smoke این خرابی را نمی‌دیدند. اصلاح شد و
> `tests/components/phone-browser.test.ts` به‌عنوان نگهبان دائمی اضافه شد.

## ۴. تست دستی سرتاسری (Smoke Test)

سرور production واقعی بالا آمد و مسیرها از طریق HTTP بررسی شدند:

```bash
curl -s http://127.0.0.1:3000/api/health
# {"ok":true,"service":"simshop","version":"1.0.0","database":"up","latencyMs":60,...}

curl -s -o /tmp/home.html -w "%{http_code}" http://127.0.0.1:3000/
# 200  ← شامل <html lang="fa" dir="rtl"> و محتوای فارسی
```

و چرخه‌ی خرید مهمان با کوکی واقعی: `GET /api/auth/csrf` → `POST /api/cart/items` → `POST /api/checkout`.

### بررسی کنسول مرورگر (خطاهای فقط-client-side)

بخشی از خرابی‌ها در HTML سرور دیده نمی‌شوند و فقط پس از hydration و اجرای fetch در مرورگر رخ می‌دهند.
برای همین، اپ با یک **Chrome واقعی (headless)** روی ۳۶ مسیر (۱۶ عمومی + ۱۴ پنل مدیریت + ۶ پنل نمایندگی،
با ورود واقعی به هر دو پنل) پیمایش شد و گزارش کنسول/`pageerror`/پاسخ‌های ≥۴۰۰ هر مسیر گرفته شد.
نتیجه‌ی این محیط: **۳۶/۳۶ بدون خطا**، شامل باز‌کردن «نمایش شماره‌های بیشتر» در صفحه‌ی اصلی
(`?page=2&limit=12` → `نمایش ۱۶ از ۱۶ شماره`).

> این پیمایش با یک هارنس موقتی Puppeteer (خارج از وابستگی‌های پروژه) اجرا شد؛ چکِ رگرسیون آن به‌صورت
> دائمی در `tests/components/phone-browser.test.ts` نگه داشته شده است.

## ۵. اعتبارسنجی‌های دیگر

| بررسی | فرمان | نتیجه |
|---|---|---|
| نوع‌ها | `npx tsc --noEmit` | بدون خطا |
| اسکیمای دیتابیس | `npx prisma validate` | معتبر |
| بیلد production | `npx next build` | موفق (۴۵ مسیر) |
| کنسول مرورگر (Chrome واقعی) | پیمایش ۳۶ مسیر | ۰ خطا، ۰ پاسخ ≥۴۰۰ |
| قالب اکسل | `npm run excel:template` | تولید و round-trip تأیید شد |
| مایگریشن روی DB واقعی | `npx prisma migrate deploy` | اعمال شد |
| seed | `npm run db:seed` | نقش‌ها، دسترسی‌ها، اپراتورها، تنظیمات، داده‌ی نمونه |

## ۶. CI

`.github/workflows/ci.yml` روی هر push/PR: نصب → `prisma validate` → `tsc --noEmit` → `migrate deploy` → `db seed` → `vitest run` → تولید قالب اکسل → `next build` — با سرویس‌های PostgreSQL و Redis واقعی.
