# ۰۹ — ایمپورت اکسل

کد: `src/lib/excel/*` (columns · parse · template · export) و `src/lib/services/import.service.ts`
قالب‌های نمونه: [`samples/phone-numbers-template.xlsx`](../samples/phone-numbers-template.xlsx) · [`samples/modems-template.xlsx`](../samples/modems-template.xlsx)

## ۱. تولید قالب

```bash
npm run excel:template          # ساخت فایل‌های نمونه در samples/
npm run excel:template:verify   # تولید و اعتبارسنجی خودکار (round-trip)
```
اندپوینت‌ها: `GET /api/reseller/template` و `GET /api/admin/template` (پارامتر `?type=PHONE_NUMBERS|MODEMS`).
قالب شامل سرستون‌های فارسی، سطر نمونه، توضیح هر ستون و عرض مناسب است.

## ۲. ستون‌ها

### شماره‌ها (`PHONE_COLUMNS`)
| ستون | الزامی | مترادف‌های پذیرفته‌شده |
|---|---|---|
| شماره موبایل | ✅ | msisdn, phone, mobile, number, شماره, موبایل, شماره تماس |
| قیمت (تومان) | ✅ | price, قیمت, مبلغ, قیمت فروش |
| اپراتور | — | operator, اپراتور (خالی = تشخیص خودکار از پیش‌شماره) |
| توضیحات | — | description, توضیحات, یادداشت, note |

### مودم‌ها (`MODEM_COLUMNS`)
`برند` ✅ · `مدل` ✅ · `عنوان` · `قیمت` ✅ · `موجودی` · `گارانتی` · `تصویر (URL)` · `توضیحات`

> پذیرش **مترادف‌ها** و **نرمال‌سازی متن فارسی** (تبدیل اعداد فارسی/عربی، حذف نیم‌فاصله، یکسان‌سازی «ی/ک») باعث می‌شود فایل‌های تولیدشده در اکسل، گوگل‌شیت و نرم‌افزارهای دفتری بدون تغییر قبول شوند.

## ۳. اعتبارسنجی و ایمپورت

`import.service.ts`:
1. خواندن از حافظه (حداکثر `excel.maxFileSizeMb` مگابایت، حداکثر `excel.maxRows` ردیف).
2. `mapHeaders` → نگاشت سرستون به ایندکس؛ نبود ستون الزامی → خطای صریح با نام ستون‌های مفقود.
3. اعتبارسنجی هر ردیف به‌صورت مستقل:
   - شماره: نرمال‌سازی و بررسی الگوی موبایل ایران (`09xxxxxxxxx`) + **تشخیص اپراتور از پیش‌شماره**.
   - قیمت: عددی، مثبت، پشتیبانی از «۲,۵۰۰,۰۰۰» و ارقام فارسی.
   - داخلی: **رد ردیف تکراری** (هم تکراری در فایل، هم تکراری در دیتابیس).
4. درج به‌صورت batch در تراکنش، با `ownerType` و `resellerId` (نماینده → محصول خودش).
5. ثبت `ExcelImportLog`: `totalRows`, `successRows`, `failedRows`, `errors Json` (شماره‌ی سطر + دلیل فارسی).

## ۴. پاسخ گام‌به‌گام به کاربر

پس از ایمپورت، UI گزارشی فارسی نشان می‌دهد:

```
۱۴۸ ردیف خوانده شد · ۱۴۰ موفق · ۸ ناموفق
سطر ۱۲: شماره «0912000000» معتبر نیست (باید ۱۱ رقم و با 09 شروع شود)
سطر ۳۴: شماره «09121234567» قبلاً در سیستم ثبت شده است
سطر ۵۱: قیمت خالی یا نامعتبر است
```

نماینده/ادمین می‌تواند فایل را اصلاح و دوباره آپلود کند؛ چون تکراری‌ها رد می‌شوند، **ایمپورت دوباره امن است**.

## ۵. خروجی اکسل گزارش‌ها
`src/lib/excel/export.ts` → `buildExportWorkbook`؛ هدر پاسخ با `xlsxHeaders(filename)` و فایل دارای **BOM UTF-8** است تا در اکسل فارسی درست باز شود.
اندپوینت‌ها: `GET /api/admin/reports/export` و `GET /api/reseller/reports/export`.

## ۶. نمونه‌ی فراخوانی

```bash
CSRF=$(curl -s -c cj https://shop.example.ir/api/auth/csrf | jq -r .data.csrfToken)
curl -b cj -X POST https://shop.example.ir/api/reseller/import \
  -H "x-csrf-token: $CSRF" -F 'type=PHONE_NUMBERS' -F 'file=@numbers.xlsx'
```
