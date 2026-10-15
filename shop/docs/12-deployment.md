# ۱۲ — دیپلوی روی ساب‌دامین

هدف: اجرای فروشگاه روی `shop.example.ir` با HTTPS، دیتابیس، Redis، بکاپ خودکار و پایش.

## ۱. پیش‌نیازها

- سرور لینوکس (اوبونتو ۲۲/۲۴) با **Docker Engine** و **Docker Compose v2**.
- دامنه با رکورد `A` ساب‌دامین → IP سرور (مثال: `shop.example.ir → 5.x.x.x`).
- پورت‌های ۸۰ و ۴۴۳ باز.
- **توصیه:** سرور **ایرانی** برای استفاده از درگاه پرداخت ایرانی (بیشتر درگاه‌ها برای دامنه‌ی ایرانی/سرور ایران پاسخگوترند). اگر سرور خارجی است، فقط مسیرهای درگاه باید در دسترس باشند.

## ۲. استقرار در ۶ گام

```bash
# ۱) دریافت کد
git clone <repo> simshop && cd simshop

# ۲) ساخت فایل محیطی
cp .env.example .env
nano .env     # مقادیر بخش ۳ را پر کنید

# ۳) رمزهای امنیتی
openssl rand -base64 48        # → SESSION_SECRET

# ۴) نخستین اجرای SSL (صدور گواهی Let's Encrypt)
mkdir -p certbot/conf certbot/www
docker compose up -d nginx
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d shop.example.ir --email admin@example.ir --agree-tos --no-eff-email

# ۵) بالا آوردن کل استک
docker compose up -d --build

# ۶) بررسی
curl -fsS https://shop.example.ir/api/health
docker compose logs -f app
```

> در نخستین اجرا، `docker-entrypoint.sh` مایگریشن‌ها را با `prisma migrate deploy` اعمال و با `RUN_SEED=true` داده‌ی پایه (نقش‌ها، دسترسی‌ها، اپراتورها، تنظیمات، حساب سوپر‌ادمین) را ایجاد می‌کند.

### بخش‌های ضروری `.env`
```dotenv
SHOP_DOMAIN=shop.example.ir
POSTGRES_USER=shop
POSTGRES_PASSWORD=<رمز قوی>
POSTGRES_DB=shop
REDIS_PASSWORD=<رمز قوی>
SESSION_SECRET=<خروجی openssl rand -base64 48>
CRON_SECRET=<رشته تصادفی>
NEXT_PUBLIC_APP_URL=https://shop.example.ir
SEED_ADMIN_PASSWORD=<رمز اولیه سوپر‌ادمین>
BCRYPT_COST=12
BACKUP_KEEP_DAYS=14
```

## ۳. معماری اجرا

```
اینترنت
  └─ Nginx (:80 → ریدایرکت، :443 TLS)
      ├─ /usr/share/nginx/html  (challenge بکاپ Certbot)
      ├─ /_next/static , /fonts  (cache پایدار ۱ ساله)
      ├─ /api/auth/*  (rate-limit سختگیرانه)
      ├─ /api/*       (proxy به app)
      └─ /            (proxy به app)
           └─ app (Next.js standalone, کاربر non-root, :3000 داخلی)
                ├─ postgres:16  (بدون پورت بیرونی)
                ├─ redis:7      (بدون پورت بیرونی)
                └─ [backup]  pg_dump شبانه  +  [uptime]  Uptime Kuma
```

- `docker-compose` پورت‌های ۵۴۳۲ و ۶۳۷۹ را با `expose` باز می‌کند، نه `ports` — دیتابیس از بیرون قابل دسترس نیست.
- اپ روی `node server.js` با `tini` به‌عنوان PID 1 (مدیریت صحیح سیگنال/زومبی).
- `HEALTHCHECK` روی `/api/health` هر ۳۰ ثانیه.

## ۴. گواهی SSL و تمدید خودکار

- صدور اولیه با `certbot certonly --webroot` (گام ۴).
- تمدید خودکار: سرویس `certbot` هر ۱۲ ساعت `certbot renew` اجرا می‌کند.
- برای فعال‌شدن گواهی جدید، `nginx` را reload کنید:
  ```bash
  docker compose exec nginx nginx -s reload
  ```

## ۵. بکاپ و بازیابی

- سرویس `backup` هر شب `BACKUP_CRON` (پیش‌فرض `0 3 * * *` به وقت تهران) `scripts/backup.sh` را اجرا می‌کند:
  `pg_dump | gzip -9` در `./backups/shop-YYYYMMDD-HHMM.sql.gz` و حذف نسخه‌های قدیمی‌تر از `BACKUP_KEEP_DAYS`.
- **بازیابی:**
  ```bash
  gunzip -c backups/shop-20261012-0300.sql.gz | \
    docker compose exec -T postgres psql -U shop -d shop
  ```
- برای بکاپ خارج از سرور، پوشه‌ی `./backups` را به یک فضای ابری/دیسک جدا sync کنید.
- **مهم:** یک بار بازیابی آزمایشی روی یک دیتابیس موقت انجام دهید.

## ۶. مایگریشن و به‌روزرسانی

```bash
git pull
docker compose build app
docker compose up -d app       # entrypoint خودکار migrate deploy را اجرا می‌کند
docker compose exec nginx nginx -s reload
```
در محیط توسعه: `npx prisma migrate dev`؛ در تولید فقط `prisma migrate deploy` (بدون reset).

## ۷. پایش و نگهداشت

- **Uptime Kuma:** روی `127.0.0.1:3001` (فقط لوکال، از طریق SSH tunnel قابل دسترس) — پایش `/api/health` و گواهی SSL.
- **لاگ‌ها:** `docker compose logs -f app` و `./backups/backup.log`.
- **Cron نگهداری:** فراخوانی دوره‌ای `/api/cron/maintenance` با هدر `x-cron-secret` برای آزادسازی رزروهای منقضی و پاک‌سازی سبدهای رهاشده (می‌توانید در `crontab` سرور تنظیم کنید).
- **Sentry (اختیاری):** با `NEXT_PUBLIC_SENTRY_DSN` در `.env` و راه‌اندازی wizard رسمی.

## ۸. تنظیمات پس از استقرار (از پنل ادمین)

1. ورود به `/admin/login` با `superadmin` و تغییر رمز.
2. فعال‌سازی **ورود دو‌مرحله‌ای** (`security.requireAdminTwoFactor = true`).
3. **پرداخت:** انتخاب درگاه فعال و وارد کردن کلید؛ سندباکس را در ابتدا `true` بگذارید و پس از آزمایش `false` کنید.
4. **پیامک:** انتخاب Provider، کلید و شماره‌ی فرستنده، `sms.adminMobiles`.
5. **فروش:** کمیسیون، مدت رزرو، آستانه‌ی رند، مالیات، ارسال فیزیکی، الزام کد ملی.
6. بررسی `payment.callbackBaseUrl` = `https://shop.example.ir`.

## ۹. عیب‌یابی سریع

| نشانه | بررسی |
|---|---|
| `502` از Nginx | `docker compose logs app`؛ آیا `/api/health` داخل کانتینر جواب می‌دهد؟ |
| کاربر به درگاه می‌رود ولی برنمی‌گردد | `payment.callbackBaseUrl` و `NEXT_PUBLIC_APP_URL` باید دقیقاً دامنه‌ی HTTPS باشند |
| کد خطای درگاه | `Payment.requestPayload`/`verifyPayload` را در جزئیات سفارش یا لاگ check کنید |
| پیامک ارسال نمی‌شود | `/admin/sms` → وضعیت `FAILED` و `errorMessage`؛ اعتبار کلید Provider |
| «توکن امنیتی نامعتبر» | ناهمگامی دامنه/`SameSite`؛ کوکی `csrf` باید روی همان دامنه ست شود |
| vendor lock یا کندی دیسک | `docker system prune`، فضای volume `pgdata` |

## ۱۰. مقیاس‌دهی

- **عمودی:** افزایش منابع app و PostgreSQL.
- **افقی:** چند نمونه‌ی `app` پشت Nginx (بدون state داخل app؛ نشست JWT و سبد در کوکی/DB) + Redis مشترک برای rate-limit و کش.
- **دیتابیس:** افزودن read replica برای گزارش‌ها و جدا کردن `DATABASE_URL` گزارش‌ها.
