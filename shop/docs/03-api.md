# ۰۳ — مستندات API

پیشوند: `/api` · قالب پاسخ استاندارد:

```json
{ "ok": true,  "data": { } }
{ "ok": false, "error": { "code": "BAD_REQUEST", "message": "پیام فارسی", "details": [] } }
```

**کدهای خطا:** `BAD_REQUEST(400)` · `UNAUTHORIZED(401)` · `FORBIDDEN(403)` · `NOT_FOUND(404)` · `CONFLICT(409)` · `PAYMENT_ERROR(402)` · `TOO_MANY_REQUESTS(429)` · `INTERNAL(500)`

**امنیت همه‌ی درخواست‌های تغییردهنده (POST/PUT/PATCH/DELETE):** هدر `x-csrf-token` باید با کوکی `csrf` یکسان باشد و `Origin` هم‌مبدأ باشد.

---

## ۱. احراز هویت

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/auth/csrf` | صدور/دریافت توکن CSRF |
| POST | `/api/auth/register` | ثبت‌نام مشتری |
| POST | `/api/auth/login` | ورود (نام کاربری/ایمیل/موبایل + رمز) |
| POST | `/api/auth/logout` | خروج |
| GET | `/api/auth/me` | کاربر جاری + دسترسی‌ها |
| POST | `/api/auth/2fa` | فعال‌سازی/تأیید ورود دو‌مرحله‌ای (TOTP) |
| POST | `/api/auth/reseller/register` | درخواست ثبت‌نام نماینده (نیازمند تأیید ادمین) |

**نمونه‌ی ورود**
```bash
curl -c cj -s https://shop.example.ir/api/auth/csrf
curl -b cj -c cj -X POST https://shop.example.ir/api/auth/login \
  -H 'content-type: application/json' -H "x-csrf-token: $CSRF" \
  -d '{"identifier":"superadmin","password":"•••"}'
```

## ۲. کاتالوگ (عمومی)

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/operators` | اپراتورها + پیش‌شماره‌ها + پله‌های قیمت کد فعال‌سازی |
| GET | `/api/products/phones` | جست‌وجو + فیلتر پیشرفته + صفحه‌بندی |
| GET | `/api/products/phones/[id]` | جزئیات شماره (+ افزایش بازدید) |
| GET | `/api/products/modems` | لیست مودم‌های موجود |
| GET | `/api/products/modems/[id]` | جزئیات مودم |
| POST | `/api/activation/quote` | محاسبه‌ی خودکار قیمت کد فعال‌سازی |

**پارامترهای `/api/products/phones`**
`operator` (کد یا slug) · `minPrice`/`maxPrice` · `prefix` · `suffix` · `pattern` (مثال `0912****111`) · `rond` · `sequential` · `repeated` · `palindrome` · `digits` (۸..۱۱) · `q` (جستجوی سریع) · `sort` (`price_asc|price_desc|newest|popular|rond`) · `page` · `limit` (حداکثر ۵۰) · `inStockOnly`

```bash
curl 'https://shop.example.ir/api/products/phones?operator=mci&minPrice=2000000&pattern=0912****111&rond=true&sort=price_asc&page=1&limit=20'
```

## ۳. سبد خرید

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/cart` | مشاهده‌ی سبد + جمع‌ها (قیمت زنده) |
| POST | `/api/cart/items` | افزودن: `phoneNumberId` یا `modemId`+`quantity` یا `operatorId`+`quantity` |
| PATCH | `/api/cart/items/[id]` | تغییر تعداد |
| DELETE | `/api/cart/items/[id]` | حذف آیتم |
| POST | `/api/cart/clear` | خالی کردن سبد |

سبد با کوکی `cart` شناسایی می‌شود؛ با ورود کاربر، سبد مهمان به حساب او متصل می‌گردد.

## ۴. پرداخت

| متد | مسیر | توضیح |
|---|---|---|
| POST | `/api/checkout` | ثبت سفارش + رزرو + دریافت `redirectUrl` |
| GET/POST | `/api/payment/callback/[gateway]` | بازگشت از درگاه (زرین‌پال/آیدی‌پی/نکست‌پی) |

**بدنه‌ی `/api/checkout`**
```json
{ "customerName":"علی رضایی", "customerPhone":"09121234567",
  "customerEmail":"a@b.ir", "nationalId":"0012345678",
  "province":"تهران", "city":"تهران", "address":"...", "postalCode":"...", "note":"..." }
```
پاسخ: `{ orderNumber, trackingCode, total, redirectUrl }`

نکات:
- کد ملی فقط برای سفارش دارای **کد فعال‌سازی** و صرفاً برای کاربر وارد‌شده الزامی است.
- نشانی فقط برای سفارش **فیزیکی** و در صورت فعال بودن `shop.shipToCustomerEnabled` الزامی است.
- هر درگاه یک آداپتر است؛ مسیر callback خودکار ساخته می‌شود: `/api/payment/callback/{gateway}?order=…`.

## ۵. سفارش‌ها و پیگیری

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/orders/track` | پیگیری با `?code=TRACKINGCODE` یا `?phone=…` |

## ۶. پنل نمایندگان (نیازمند نقش `RESELLER` یا بالاتر)

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/reseller/phones` · POST | لیست / ثبت دستی شماره |
| PATCH/DELETE | `/api/reseller/phones/[id]` | ویرایش/حذف (فقط در وضعیت موجود) |
| GET | `/api/reseller/modems` · POST | لیست / ثبت مودم |
| PATCH/DELETE | `/api/reseller/modems/[id]` | ویرایش/حذف |
| POST | `/api/reseller/import` | ایمپورت گروهی از اکسل (`multipart/form-data`) |
| GET | `/api/reseller/template` | دانلود قالب اکسل استاندارد |
| GET | `/api/reseller/reports` | گزارش فروش و کمیسیون |
| GET | `/api/reseller/reports/export` | خروجی اکسل گزارش |
| GET | `/api/reseller/stats` | کارت‌های آماری داشبورد |
| GET | `/api/reseller/settlements` · POST | درخواست تسویه |

نماینده فقط به محصولات **خودش** دسترسی دارد؛ مالکیت در هر کوئری با `resellerId` اعمال می‌شود.

## ۷. پنل مدیریت (نیازمند دسترسی متناظر)

| متد | مسیر | دسترسی |
|---|---|---|
| GET | `/api/admin/stats` | `dashboard.view` |
| GET/POST/PATCH/DELETE | `/api/admin/phones[/id]` | `products.phones.*` |
| GET/POST/PATCH/DELETE | `/api/admin/modems[/id]` | `products.modems.*` |
| GET/POST | `/api/admin/activation-prices[/id]` | `products.activation.*` |
| GET | `/api/admin/orders` · PATCH `/api/admin/orders/[id]` | `orders.read` / `orders.write` |
| GET/PATCH | `/api/admin/resellers[/id]` | `resellers.read/write/approve` |
| GET/PATCH | `/api/admin/settlements[/id]` | `resellers.settle` |
| GET | `/api/admin/reports` · `/export` | `reports.read` / `reports.export` |
| GET/POST | `/api/admin/sms` · `/api/admin/sms/send` | `sms.read` / `sms.send` |
| GET/PUT | `/api/admin/settings` | `settings.read` / `settings.write` |
| GET/PATCH | `/api/admin/users[/id]` | `users.read` / `users.write` |
| GET | `/api/admin/audit` | `audit.read` |
| POST | `/api/admin/import` | ایمپورت اکسل توسط ادمین |
| GET | `/api/admin/import-logs` | تاریخچه‌ی ایمپورت‌ها |
| GET | `/api/admin/template` | قالب اکسل (شماره/مودم) |

## ۸. عمومی و عملیاتی

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/health` | سلامت سرویس + تأخیر دیتابیس |
| POST | `/api/contact` | فرم تماس با ما (با rate-limit) |
| POST | `/api/cron/maintenance` | آزادسازی رزروهای منقضی و پاک‌سازی (نیازمند `x-cron-secret`) |

`rate-limit` پیش‌فرض: `auth` ۱۰/۵دق، `checkout` ۲۰/۱۰دق، `contact` ۵/۱۰دق — قابل تنظیم در `src/lib/rate-limit.ts`.
