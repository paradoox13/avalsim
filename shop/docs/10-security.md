# ۱۰ — امنیت

## ۱. احراز هویت

- **رمز عبور:** `bcryptjs` با هزینه‌ی `BCRYPT_COST` (پیش‌فرض ۱۲). رمز هرگز برنمی‌گردد و در پاسخ‌ها نیست.
- **نشست:** JWT امضاشده با `jose` (HS256، کلید `SESSION_SECRET` ≥ ۳۲ کاراکتر) در کوکی:
  `HttpOnly` + `SameSite=Lax` + `Secure` در production + `Path=/`.
- **CSRF:** الگوی *double-submit cookie* — هدر `x-csrf-token` باید با کوکی مطابقت کند
  (`src/lib/csrf.ts → assertCsrf`). علاوه بر آن، هدر `Origin` با `Host`/`NEXT_PUBLIC_APP_URL` مقایسه می‌شود (`assertSameOrigin`).
- **ورود دو‌مرحله‌ای (2FA):** TOTP با `otplib`؛ راه‌اندازی با QR (`qrcode`). اجبارپذیر برای ادمین‌ها با `security.requireAdminTwoFactor`.
- **قفل حساب:** پس از `security.maxLoginAttempts` (پیش‌فرض ۵) تلاش ناموفق در بازه‌ی `security.lockoutMinutes` (۱۵)، ورود قفل می‌شود. تلاش‌ها در جدول `LoginAttempt` ثبت می‌شوند.

## ۲. کنترل دسترسی (RBAC)

- نقش‌ها: `CUSTOMER · RESELLER · ADMIN · SUPER_ADMIN`.
- دسترسی‌ها با کلید «منبع.عملیات» در `src/lib/auth/rbac.ts` (۲۷ کلید) و در جداول `Role/Permission/RolePermission` نگهداری می‌شوند.
- توابع خالص: `can(user, perm)` · `isAdmin(user)` · `isReseller(user)` — کاملاً تست‌شده.
- **هر API** با `requirePermission`/`requireRole` محافظت می‌شود، نه فقط مخفی‌کردن دکمه در UI.
- **تفکیک مالکیت:** کوئری‌های نماینده همیشه با `resellerId` فیلتر می‌شوند؛ دسترسی به محصول دیگری ممکن نیست.
- **Defense in depth:** `src/middleware.ts` مسیرهای `/admin/*`, `/reseller/*`, `/account/*` را در لبه گارد می‌کند و سپس API معتبرسازی مستقل انجام می‌دهد.

## ۳. اعتبارسنجی ورودی

- همه‌ی بدنه‌های ورودی با **zod** در `src/lib/validation/*` پارس می‌شوند (`readJson`). خطای اعتبارسنجی → پیام فارسی `BAD_REQUEST` با جزئیات.
- اعتبارسنجی کد ملی ایران (`isValidIranianNationalId`) با الگوریتم رقم کنترلی.
- اعتبارسنجی موبایل ایران `^09\d{9}$`، نرمال‌سازی ارقام فارسی/عربی.
- **SQL Injection:** تمام کوئری‌ها با Prisma به‌صورت پارامتری ساخته می‌شوند؛ هیچ رشته‌ی SQL خام ساخته نمی‌شود (حتی فیلتر الگوی شماره).
- **XSS:** React به‌صورت پیش‌فرض escape می‌کند؛ جایی که `dangerouslySetInnerHTML` لازم است (صفحات محتوایی) ورودی از ادمین و پاک‌سازی‌شده است. هدر `Content-Security-Policy` نیز اعمال می‌شود.
- **آپلود فایل:** فقط `xlsx` و محدود به `excel.maxFileSizeMb`؛ پارس با `exceljs` بدون اجرای ماکرو.

## ۴. محدودیت نرخ و هدرها

- Rate limit در لبه‌ی هر مسیر حساس (`src/lib/rate-limit.ts`) با پشتوانه‌ی **Redis** و fallback خودکار به حافظه‌ی محلی.
  `auth ۱۰/۵دق` · `checkout ۲۰/۱۰دق` · `contact ۵/۱۰دق`.
- هدرهای امنیتی در `next.config.mjs`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, CSP.
- شناسه‌ی درخواست (`x-request-id`) برای پیگیری در لاگ‌ها.

## ۵. رمزنگاری داده‌های حساس

- کلیدهای درگاه و پیامک در جدول `Setting` با نوع `SECRET` نگهداری می‌شوند.
- `getAllSettingsForAdmin` مقادیر SECRET را **ماسک** می‌کند و `getPublicSettings` هرگز آن‌ها را برنمی‌گرداند.
- `SESSION_SECRET` و `CRON_SECRET` فقط از متغیر محیطی خوانده می‌شوند (خارج از دیتابیس و گیت).

## ۶. لاگ‌گیری و ممیزی

- `AuditLog` برای هر عملیات حساس: `action`, `entity`, `entityId`, `before`, `after`, `userId`, `ip`, `userAgent`, زمان.
- `SmsLog` برای هر ارسال پیامک.
- رکورد `LoginAttempt` برای ورودهای ناموفق.
- پنل ادمین → «لاگ تغییرات» قابل فیلتر و جست‌وجو.

## ۷. پایداری پرداخت

- هرگز به داده‌ی بازگشتی از درگاه اعتماد نمی‌شود؛ **verify سرور‌به‌سرور** الزامی است.
- تسویه‌ی idempotent؛ callback تکراری باعث فروش مجدد نمی‌شود (تست خودکار).
- مبلغ پرداخت با مبلغ سفارش بررسی و در `Payment` مقایسه می‌شود.
- در خطای درگاه: رزرو آزاد و سفارش `FAILED` می‌شود.

## ۸. زیرساخت

- کانتینر اپ با کاربر غیر‌روت (`nextjs:nodejs`) اجرا می‌شود؛ `tini` به‌عنوان PID 1.
- پورت دیتابیس و Redis به بیرون **باز نمی‌شود** (فقط شبکه‌ی داخلی داکر).
- Nginx با TLS و پروکسی معکوس؛ Uptime Kuma برای پایش.
- بکاپ خودکار شبانه (بخش [۱۱-دیپلوی](12-deployment.md)).
- **دقت قانونی:** داده‌ی کاربران ایرانی روی سرور با رعایت حریم خصوصی نگهداری می‌شود؛ برای فروش کد فعال‌سازی، کد ملی به‌عنوان الزام قانونی دریافت می‌گردد.

## ۹. چک‌لیست پیش از انتشار

- [ ] `SESSION_SECRET` و `CRON_SECRET` تصادفی و طولانی.
- [ ] `SEED_ADMIN_PASSWORD` قوی و تغییر رمز پیش‌فرض پس از نخستین ورود.
- [ ] `security.requireAdminTwoFactor = true`.
- [ ] کلیدهای درگاه/پیامک از پنل تنظیم شده (نه در `.env` یا گیت).
- [ ] `NEXT_PUBLIC_APP_URL` برابر دامنه‌ی نهایی ساب‌دامین.
- [ ] اجباری بودن HTTPS و `Secure` روی کوکی‌ها.
- [ ] بکاپ شبانه فعال و یک بار **بازیابی آزمایشی** انجام شده.
