# ۱۳ — فیلترهای پیشرفته‌ی شماره

پیاده‌سازی: `src/lib/filters/phone-filter.ts` (خالص) · اعتبارسنجی: `src/lib/validation/product.ts` · API: `GET /api/products/phones`

## ۱. فیلترهای موجود

| فیلتر | پارامتر | مثال | توضیح |
|---|---|---|---|
| اپراتور | `operator` | `mci` | کد یا slug؛ همراه اول، ایرانسل، رایتل، شاتل، سامان‌تل و… |
| بازه‌ی قیمت | `minPrice`,`maxPrice` | `2000000`..`5000000` | تومان |
| پیش‌شماره | `prefix` | `0912` | `startsWith` |
| پسوند | `suffix` | `111` | `endsWith` |
| الگوی عددی خاص | `pattern` | `0912****111` یا `0912????11` | `*` = هر تعداد رقم، `?` = دقیقاً یک رقم |
| شماره‌ی رند | `rond=true` | | `rondScore >= shop.rondThreshold` یا الگوی رند |
| تکراری | `repeated=true` | | ارقام تکراری (مثل `0912**1111**`) |
| متوالی | `sequential=true` | | دنباله‌ی صعودی/نزولی |
| آینه (پالیندروم) | `palindrome=true` | | خواندن از دو طرف یکسان |
| تعداد ارقام | `digits` | `11` | ۸ تا ۱۱ |
| جستجوی سریع | `q` | `0912` | تطبیق جزئی |
| مرتب‌سازی | `sort` | `price_asc` | `price_asc, price_desc, newest, popular, rond` |
| فقط موجود | `inStockOnly` | `true` | `status = AVAILABLE` |
| صفحه‌بندی | `page`,`limit` | `1`,`20` | `limit` حداکثر ۵۰ |

## ۲. الگوی عددی (`pattern`)

```
0912****111   →  پیش‌شماره 0912 ، هر تعداد رقم در میان ، پسوند 111
0912????111   →  دقیقاً چهار رقم دلخواه در میان
```

تبدیل الگو به فراخوانی Prisma (بدون SQL خام، کاملاً پارامتری):

```ts
// `*` → LIKE با %  ·  `?` → _
const where = { msisdn: { startsWith, endsWith, contains } };
// یا برای الگوهای پیچیده‌تر:
prisma.phoneNumber.findMany({ where: { msisdn: { not: { startsWith: '0' } } } }) // نمونه
```

جزئیات دقیق در فایل پیاده‌سازی؛ هرگز رشته‌ی خام SQL ساخته نمی‌شود → **بدون ریسک SQL Injection**.

## ۳. تحلیل خودکار در زمان ثبت

هنگام ثبت (نماینده یا ادمین) تابع `analyzeNumber(msisdn)` در `src/lib/utils/pattern.ts` اجرا و ذخیره می‌شود:

- `isRepeated` — الگوی تکرار (مثل `1111`، `1212`).
- `isSequential` — دنباله (`1234`, `4321`).
- `isPalindrome` — آینه.
- `isRond` و `rondScore` (۰..۱۰۰) — امتیاز زیبایی ترکیبی.

ذخیره‌سازی این مقادیر باعث می‌شود فیلترها **آیندکس‌شده و سریع** باشند، نه محاسبه‌ی زمان‌کوئری.

## ۴. مرتب‌سازی و بارگذاری تدریجی

- `price_asc` / `price_desc` روی `price` (ایندکس‌دار).
- `newest` روی `createdAt`.
- `popular` روی `views`.
- `rond` روی `rondScore`.
- فرانت‌اند با `limit` کوچک و اسکرول، صفحه‌ی بعد را با `page++` می‌گیرد (`src/components/site/phone-grid.tsx`).

## ۵. پنهان‌سازی خودکار

تمام کوئری‌های فروشگاه به‌صورت پیش‌فرض روی `status IN (AVAILABLE)` (و در صورت نیاز `RESERVED` منقضی‌شده) فیلتر می‌شوند.
پس از فروش، شماره `SOLD` شده و بلافاصله از نتایج و صفحه‌ی محصول حذف می‌گردد.
