# ۱۴ — بالا آوردن سایت روی هاست (راهنمای گام‌به‌گام)

این سند از صفر تا صدِ «چه بخرم، چه نصب کنم، چه دستوری بزنم» را برای اجرای **سیم‌شاپ** روی
هاست واقعی توضیح می‌دهد. اگر فقط می‌خواهید سریع راه بیفتید، **مسیر A (داکر)** را انتخاب کنید؛
اگر سرور شما داکر ندارد، **مسیر B** را دنبال کنید.

> مستند `12-deployment.md` مرجع معماری و تنظیمات پیشرفته است. این سند، نسخه‌ی عمل‌گرایانه‌ی
> «از خرید هاست تا اولین ورود به پنل» است.

---

## ۰) خلاصه‌ی تصمیم‌گیری

| وضعیت شما | مسیر پیشنهادی | زمان تقریبی |
|---|---|---|
| VPS لینوکسی با دسترسی root | **A — Docker Compose** | ۲۰ دقیقه |
| VPS لینوکسی بدون داکر | **B — PM2 + Nginx** | ۳۰ دقیقه |
| هاست اشتراکی cPanel/DirectAdmin | **C — با محدودیت** | متغیر |

**سه نکته‌ی حیاتی قبل از شروع:**

1. **سرور را ایرانی بگیرید.** درگاه‌های پرداخت ایرانی (زرین‌پال، IDPay، نکست‌پی) و سامانه‌های
   پیامک (کاوه‌نگار، ملی‌پیامک) معمولاً IP و دامنه‌ی ایرانی را بدون اصطکاک می‌پذیرند. روی
   سرور خارجی هم کار می‌کند، اما احتمال بلاک شدن یا خطای IP را دارید.
2. **دامنه + HTTPS اجباری است.** درگاه پرداخت بدون `https` callback شما را تأیید نمی‌کند و
   کوکی نشست در حالت `production` با `Secure` علامت می‌خورد؛ پس **روی HTTP خالص نمی‌توانید
   وارد پنل ادمین شوید** (این عمدی و امنیتی است).
3. **`SESSION_SECRET` را با `openssl rand -base64 48` بسازید.** کد با کلید کمتر از ۳۲ کاراکتر
   در حالت production بالا نمی‌آید.

---

## ۱) پیش‌نیازها

### نرم‌افزار موردنیاز
| مورد | نسخه | توضیح |
|---|---|---|
| Node.js | **≥ ۲۰** (توصیه: ۲۰ LTS یا ۲۲) | `node -v` |
| PostgreSQL | **≥ ۱۵** (توصیه: ۱۶) | داکر خودش `postgres:16` می‌آورد |
| Redis | ۷ (اختیاری) | بدون آن، rate-limit روی حافظه‌ی محلی کار می‌کند |
| Nginx | ۱.۲۴+ | برای TLS و پروکسی |
| Docker Engine + Compose v2 | فقط مسیر A | `docker compose version` |

### منابع سرور
- حداقل **۲ vCPU / ۴ GB RAM / ۴۰ GB SSD**.
- مرحله‌ی `next build` به حدود **۲ GB رم** نیاز دارد. اگر سرور ۱ GB دارد، روی سیستم خودتان
  بیلد کنید و فقط خروجی را آپلود کنید (بخش ۳-۵).

### دامنه
یک رکورد `A` بسازید و منتظر انتشار DNS بمانید:

```
shop.example.ir.   A   5.x.x.x      # IP سرور شما
```

بررسی: `dig +short shop.example.ir` باید همان IP را بدهد.

---

## ۲) مسیر A — اجرا با Docker Compose (پیشنهادی)

کل استک (Next.js + PostgreSQL + Redis + Nginx + SSL + بکاپ شبانه + Uptime Kuma) با یک فایل
`docker-compose.yml` بالا می‌آید.

```bash
# ۱) نصب داکر (اوبونتو)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# ۲) دریافت کد
git clone <repo-url> /opt/simshop && cd /opt/simshop

# ۳) ساخت فایل محیطی
cp .env.example .env
openssl rand -base64 48          # خروجی → SESSION_SECRET
openssl rand -hex 24             # خروجی → CRON_SECRET
nano .env

# ۴) صدور گواهی SSL اولیه (قبل از بالا آوردن کل استک)
mkdir -p certbot/conf certbot/www
docker compose up -d nginx
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d shop.example.ir --email admin@example.ir --agree-tos --no-eff-email

# ۵) بالا آوردن همه‌چیز (entrypoint خودش migrate deploy + seed را اجرا می‌کند)
docker compose up -d --build

# ۶) بررسی
curl -fsS https://shop.example.ir/api/health
docker compose logs -f app
```

مقادیر **حتماً پر شوند** در `.env`:

```dotenv
SHOP_DOMAIN=shop.example.ir
NEXT_PUBLIC_APP_URL=https://shop.example.ir
POSTGRES_USER=shop
POSTGRES_PASSWORD=<رمز قوی>
POSTGRES_DB=shop
REDIS_PASSWORD=<رمز قوی>
SESSION_SECRET=<openssl rand -base64 48>
CRON_SECRET=<رشته تصادفی>
SEED_ADMIN_PASSWORD=<رمز اولیه سوپر‌ادمین — بعداً عوض کنید>
BCRYPT_COST=12
RUN_SEED=true          # بعد از اولین اجرا می‌توانید false کنید
BACKUP_KEEP_DAYS=14
```

**به‌روزرسانی نسخه در آینده:**
```bash
cd /opt/simshop && git pull
docker compose build app
docker compose up -d app        # entrypoint خودکار migrate deploy می‌زند
docker compose exec nginx nginx -s reload
```

---

## ۳) مسیر B — بدون داکر: VPS + PM2 + Nginx

### ۳-۱) نصب پیش‌نیازها (اوبونتو ۲۲/۲۴)

```bash
sudo apt update && sudo apt upgrade -y
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential
# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
# Redis (اختیاری)
sudo apt install -y redis-server
# Nginx + PM2
sudo apt install -y nginx
sudo npm i -g pm2
```

### ۳-۲) ساخت دیتابیس و کاربر

```bash
sudo -u postgres psql <<'SQL'
CREATE USER shop WITH PASSWORD 'رمز-قوی-دیتابیس';
CREATE DATABASE shop OWNER shop ENCODING 'UTF8';
GRANT ALL PRIVILEGES ON DATABASE shop TO shop;
SQL
```

تست اتصال: `psql "postgresql://shop:رمز@127.0.0.1:5432/shop" -c '\dt'`

### ۳-۳) آوردن کد و وابستگی‌ها

```bash
sudo mkdir -p /var/www/simshop && sudo chown -R $USER:$USER /var/www/simshop
git clone <repo-url> /var/www/simshop && cd /var/www/simshop
npm ci                    # دقیقاً بر اساس package-lock.json
```

> اگر رم سرور کم است، روی سیستم خودتان `npm run build` بزنید و پوشه‌های `.next` و
> `node_modules` را با `rsync`/`scp` آپلود کنید.

### ۳-۴) فایل `.env`

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # SESSION_SECRET
nano .env
```

```dotenv
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://shop.example.ir
DATABASE_URL="postgresql://shop:رمز-قوی-دیتابیس@127.0.0.1:5432/shop?schema=public"
SESSION_SECRET=<۴۸ بایت تصادفی base64>
CRON_SECRET=<رشته تصادفی>
BCRYPT_COST=12
REDIS_URL=redis://:رمز-ردیس@127.0.0.1:6379      # اگر Redis نصب نکردید، این خط را حذف کنید
SEED_ADMIN_PASSWORD=<رمز اولیه سوپر‌ادمین>
```

```bash
chmod 600 .env     # فقط کاربر سرویس بتواند بخواند
```

### ۳-۵) ساخت جداول، داده‌ی پایه و بیلد

```bash
cd /var/www/simshop

# اعمال مایگریشن‌ها روی دیتابیس خالی
npx prisma generate
npx prisma migrate deploy

# داده‌ی پایه: نقش‌ها، دسترسی‌ها، اپراتورها، تنظیمات، حساب سوپر‌ادمین
npm run db:seed

# بیلد پروداکشن
npm run build
```

> `db:seed` به `tsx` نیاز دارد که یک devDependency است. چون `npm ci` کامل اجرا شده، مشکلی
> نیست. اگر بعداً `npm prune --omit=dev` زدید، دیگر نمی‌توانید seed بزنید — پس **اول seed،
> بعد prune**.

### ۳-۶) اجرای دائمی با PM2

```bash
cd /var/www/simshop
pm2 start npm --name simshop -- run start
pm2 startup            # دستور خروجی را کپی و اجرا کنید
pm2 save
pm2 logs simshop       # مشاهده‌ی لاگ
```

بررسی محلی: `curl -s http://127.0.0.1:3000/api/health` → باید `"database":"up"` بدهد.

> اگر پورت ۳۰۰۰ اشغال است، در PM2 متغیر بدهید: `PORT=3100 pm2 start npm --name simshop -- run start`
> و همان پورت را در Nginx تنظیم کنید.

### ۳-۷) Nginx + SSL

```bash
sudo cp nginx/shop.conf.template /etc/nginx/sites-available/simshop.conf
sudo nano /etc/nginx/sites-available/simshop.conf   # shop.example.ir و proxy_pass را چک کنید
sudo ln -s /etc/nginx/sites-available/simshop.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d shop.example.ir
```

قالب `nginx/shop.conf.template` شامل: پروکسی به اپ، کش یک‌ساله برای `/_next/static`،
rate-limit سخت‌گیرانه روی `/api/auth/*` و بستن دسترسی به فایل‌های حساس است.

بررسی خودکار تمدید: `sudo certbot renew --dry-run`

---

## ۴) مسیر C — هاست اشتراکی cPanel / DirectAdmin

**واقعیت را بدانید:** این پروژه یک **سرور Node.js در حال اجرا** است (نه فایل PHP). پس روی
هاست اشتراکی فقط در این شرایط کار می‌کند:

1. هاست پشتیبانی رسمی از **Node.js App** داشته باشد (cPanel → *Setup Node.js App*).
2. امکان تعریف **Application Startup File** و **وارد کردن متغیرهای محیطی** باشد.
3. امکان ساخت دیتابیس **PostgreSQL** بدهد (خیلی از هاست‌های ایرانی فقط MySQL دارند —
   این پروژه **PostgreSQL** می‌خواهد).
4. امکان اجرای **Cron Job** و تنظیم **SSL** باشد.

اگر هر کدام از این‌ها نبود، دو گزینه دارید: یک **VPS** بگیرید (مسیر A یا B)، یا یک سرور
مدیریت‌شده‌ی Node/PostgreSQL اجاره کنید.

روش کلی در cPanel:

```bash
# در Terminal هاست یا با SSH
cd ~/simshop
npm ci
cp .env.example .env      # سپس از File Manager مقدارها را وارد کنید
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run build
```

سپس در *Setup Node.js App*: مسیر برنامه، فایل شروع (`node_modules/next/dist/bin/next start` یا
اسکریپت `start`)، و متغیرهای محیطی را تنظیم و Restart کنید. اگر پنل اجازه‌ی `npm start` نداد:

```bash
pm2 start node_modules/next/dist/bin/next --name simshop -- start -p 3000
```

> اگر پنل فقط Passenger دارد و پروکسی معکوس نمی‌سازد، Next.js معمولاً به‌درستی سرو نمی‌شود.
> در آن صورت به هاستی با پشتیبانی Node.js واقعی یا VPS مهاجرت کنید.

---

## ۵) پس از استقرار — کارهای الزامی

### ۵-۱) اولین ورود و امن‌سازی
1. برو به `https://shop.example.ir/admin/login`
2. ورود با نام کاربری **`superadmin`** و رمزی که در `SEED_ADMIN_PASSWORD` گذاشتید.
3. **فوراً رمز را عوض کنید** (این کار `tokenVersion` را افزایش می‌دهد و همه‌ی نشست‌های قبلی
   باطل می‌شوند).
4. ورود دو‌مرحله‌ای را روشن کنید (`security.requireAdminTwoFactor = true`) و اسکن QR را
   انجام دهید.

### ۵-۲) تنظیمات فروشگاه در پنل ادمین
| بخش | مسیر | نکته |
|---|---|---|
| درگاه پرداخت | تنظیمات → پرداخت | درگاه فعال + کلید؛ **در ابتدا `sandbox = true`** و پس از آزمایش `false` |
| آدرس بازگشت | تنظیمات → `payment.callbackBaseUrl` | باید **دقیقاً** `https://shop.example.ir` باشد |
| پیامک | تنظیمات → پیامک | Provider، کلید، شماره‌ی فرستنده، `sms.adminMobiles` |
| فروش | تنظیمات → فروش | کمیسیون، مدت رزرو، آستانه‌ی رند، مالیات، ارسال فیزیکی |

اطلاعات حساس در جدول `Setting` با نوع `SECRET` ذخیره و در لاگ ماسک می‌شوند.

### ۵-۳) Cron نگه‌داشت (آزادسازی رزروهای منقضی)

```bash
crontab -e

# هر ۱۰ دقیقه
*/10 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" https://shop.example.ir/api/cron/maintenance >/dev/null
```

### ۵-۴) اجرای اسموک تست (بررسی واقعی بعد از هر دیپلوی)

```bash
cd /var/www/simshop
BASE_URL=https://shop.example.ir \
ADMIN_USERNAME=superadmin \
ADMIN_PASSWORD='رمزی که گذاشتید' \
npm run smoke
```

این اسکریپت **۲۷ بررسی واقعی HTTP** انجام می‌دهد: سلامت دیتابیس، رندر RTL صفحه‌ی اصلی، باز
بودن صفحات ورود، هدایت درست مسیرهای محافظت‌شده، فعال بودن CSRF، **جریان کامل ورود مدیر و
نماینده**، رندر هر دو داشبورد، جداسازی نقش‌ها (مدیر به پنل نماینده نرود و برعکس)، خروج و `401`
پس از خروج. اگر یکی رد شود، با کد خطا خارج می‌شود.

برای نماینده، پیش‌فرض `reseller1` است و رمزش همان `SEED_ADMIN_PASSWORD` (چون seed یک رمز
مشترک می‌دهد). در صورت نیاز با `RESELLER_USERNAME` و `RESELLER_PASSWORD` عوضش کنید.

### ۵-۵) بکاپ

اسکریپت `scripts/backup.sh` با ابزار `pg_dump` کار می‌کند و تنظیمات را از متغیرهای محیطی
`PG*` می‌خواند (در مسیر داکر، سرویس `backup` این متغیرها را خودش تنظیم می‌کند). در مسیر بدون
داکر خودتان آن‌ها را بدهید:

```bash
# دستی — خروجی در ./backups/shop-YYYYMMDD-HHMM.sql.gz
cd /var/www/simshop
BACKUP_DIR=./backups PGHOST=127.0.0.1 PGUSER=shop PGPASSWORD='رمز-قوی' \
  PGDATABASE=shop BACKUP_KEEP_DAYS=14 ./scripts/backup.sh

# زمان‌بندی خودکار (هر شب ساعت ۳ بامداد)
crontab -e
0 3 * * * cd /var/www/simshop && BACKUP_DIR=./backups PGHOST=127.0.0.1 PGUSER=shop PGPASSWORD='رمز-قوی' PGDATABASE=shop ./scripts/backup.sh >> backups/backup.log 2>&1

# بازیابی
gunzip -c backups/shop-20261015-0300.sql.gz | \
  PGPASSWORD='رمز-قوی' psql -h 127.0.0.1 -U shop -d shop
```

پوشه‌ی `backups/` را به فضای ابری/دیسک جدا همگام کنید و **یک بار بازیابی آزمایشی** انجام دهید.

---

## ۶) چک‌لیست نهایی (تیک بزنید)

- [ ] `dig +short shop.example.ir` → IP سرور
- [ ] `curl -sS https://shop.example.ir/api/health` → `{"ok":true,"database":"up",...}`
- [ ] `https://shop.example.ir/` → صفحه‌ی فارسی **راست‌به‌چپ**
- [ ] `/admin/login` بدون ورود → صفحه‌ی ورود باز می‌شود (نه حلقه‌ی ریدایرکت)
- [ ] `/admin` بدون ورود → هدایت به `/admin/login?next=%2Fadmin`
- [ ] ورود `superadmin` موفق و داشبورد رندر می‌شود
- [ ] رمز سوپر‌ادمین عوض شد + دو‌مرحله‌ای فعال شد
- [ ] گواهی SSL معتبر و `certbot renew --dry-run` موفق
- [ ] `npm run smoke` → ۲۷/۲۷ موفق
- [ ] Cron نگه‌داشت و بکاپ تنظیم شده
- [ ] یک سفارش آزمایشی در حالت sandbox تا آخر انجام شد

---

## ۷) عیب‌یابی سریع

| نشانه | علت احتمالی | راه‌حل |
|---|---|---|
| `502 Bad Gateway` | اپ بالا نیست یا پورت اشتباه | `pm2 logs simshop` / `docker compose logs app`؛ پورت `proxy_pass` را چک کنید |
| صفحه بالا می‌آید ولی استایل ندارد | بیلد ناقص یا Nginx مسیر `/_next/static` را سرو نمی‌کند | `npm run build` را دوباره بزنید؛ بلوک `location /_next/static` را چک کنید |
| ورود انجام می‌شود ولی برمی‌گردد به صفحه‌ی ورود | دامنه‌ی `NEXT_PUBLIC_APP_URL` با دامنه‌ی واقعی یکی نیست یا روی HTTP هستید | در production کوکی `Secure` است؛ حتماً HTTPS و دامنه‌ی یکسان |
| «توکن امنیتی نامعتبر است» | کوکی CSRF ست نشده یا پروکسی هدرها را عوض می‌کند | کوکی `simshop_csrf` را در DevTools ببینید؛ `proxy_set_header Host $host;` را چک کنید |
| «درخواست از مبدأ غیرمجاز» | `Origin` با `Host` نمی‌خواند | دامنه‌ی سایت را درست تنظیم کنید؛ روی دامنه‌ی دیگر تست نکنید |
| کاربر به درگاه می‌رود و برنمی‌گردد | `payment.callbackBaseUrl` اشتباه است | همان `https://shop.example.ir` |
| خطای درگاه در callback | کلید اشتباه یا sandbox روشن/خاموش برعکس | `Payment.requestPayload`/`verifyPayload` را در جزئیات سفارش ببینید |
| پیامک ارسال نمی‌شود | اعتبار/کلید Provider | `/admin/sms` → وضعیت `FAILED` و `errorMessage` |
| `SESSION_SECRET باید حداقل ۳۲ کاراکتر...` | کلید کوتاه یا تنظیم‌نشده | با `openssl rand -base64 48` بسازید |
| `P1001: Can't reach database server` | PG بالا نیست یا `DATABASE_URL` اشتباه | `systemctl status postgresql` / `pg_isready` |
| ساخت جداول نشد | مایگریشن اعمال نشده | `npx prisma migrate deploy` |
| بدون ورود هیچ‌کس نمی‌تواند وارد شود | seed اجرا نشده | `npm run db:seed` |

---

## ۸) به‌روزرسانی نسخه در آینده

```bash
cd /var/www/simshop
./scripts/backup.sh            # ۱) بکاپ قبل از هر تغییر
git pull                       # ۲) کد جدید
npm ci                         # ۳) وابستگی‌ها
npx prisma migrate deploy      # ۴) مایگریشن‌ها (بدون reset!)
npm run build                  # ۵) بیلد
pm2 reload simshop             # ۶) ری‌استارت بدون قطعی (docker: docker compose up -d app)
npm run smoke                  # ۷) تأیید
```

> در تولید **هرگز** `prisma migrate dev` یا `db:reset` نزنید؛ فقط `migrate deploy`.
