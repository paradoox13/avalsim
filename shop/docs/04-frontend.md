# ۰۴ — فرانت‌اند (فروشگاه)

## ۱. طراحی و RTL

- ریشه در `src/app/layout.tsx`: `<html lang="fa" dir="rtl">` با فونت **Vazirmatn** (self-host از `public/fonts`، `next/font/local`).
- توکن‌های رنگ/گوشه در `tailwind.config.ts` + متغیرهای CSS در `src/app/globals.css`.
- حالت تاریک/روشن با `next-themes` و کامپوننت `theme-toggle.tsx` (ذخیره در `localStorage`، احترام به `prefers-color-scheme`).
- اعداد و قیمت‌ها با `src/lib/utils/persian.ts` (`toPersianDigits`, `formatToman`) و کامپوننت `<Money/>`.
- تاریخ شمسی با `src/lib/utils/jalali.ts`.

## ۲. صفحات

| مسیر | فایل | توضیح |
|---|---|---|
| `/` | `src/app/page.tsx` | هدر، هیرو، بخش شماره‌ها، کد فعال‌سازی، مودم‌ها، فوتر |
| `/phones` | کاتالوگ کامل با فیلتر پیشرفته و صفحه‌بندی |
| `/phones/[id]` | جزئیات شماره (تولید متادیتای SEO + OpenGraph) |
| `/modems` , `/modems/[id]` | لیست و جزئیات مودم |
| `/activation` | ماشین‌حساب قیمت پله‌ای کد فعال‌سازی |
| `/cart` | سبد خرید (قیمت زنده، هشدار ناموجودی) |
| `/checkout` | فرم اطلاعات خریدار → هدایت به درگاه |
| `/payment/result` | صفحه‌ی نتیجه‌ی پرداخت (`?status=success|failed`) |
| `/track` | پیگیری سفارش با کد رهگیری/موبایل |
| `/login` , `/register` | ورود / ثبت‌نام مشتری |
| `/about` , `/contact` , `/faq` , `/privacy` , `/terms` | صفحات محتوایی |
| `/reseller/login` , `/reseller/register` | ورود/ثبت‌نام نماینده |
| `/admin/login` | ورود ادمین |

## ۳. کامپوننت‌های کلیدی فروشگاه

- **`phone-browser.tsx`** — ترکیب `phone-filters` + `phone-grid` + بارگذاری تدریجی؛ پارامترها را در URL (`searchParams`) نگه می‌دارد تا لینک قابل اشتراک باشد و با back/forward کار کند.
- **`phone-filters.tsx`** — اپراتور، اسلایدر بازه‌ی قیمت، پیش‌شماره/پسوند، جعبه‌ی الگوی عددی، سوییچ‌های رند/متوالی/تکراری/آینه، تعداد ارقام، مرتب‌سازی.
- **`phone-card.tsx`** — نشان اپراتور (رنگ اختصاصی)، برچسب «رند/متوالی»، قیمت، دکمه‌ی افزودن به سبد.
- **`activation-calculator.tsx`** — انتخاب اپراتور + تعداد → فراخوانی `/api/activation/quote` → نمایش قیمت پله‌ای و افزودن به سبد.
- **`modem-card.tsx`** — تصویر، برند/مدل، موجودی، قیمت.

## ۴. لایه‌ی کلاینت

`src/lib/client/api.ts` — یک wrapper کوچک روی `fetch`:

```ts
// افزودن خودکار هدر CSRF، پرتاب خطای فارسی، تایپ خروجی
await api.post('/api/cart/items', { productType: 'PHONE_NUMBER', phoneNumberId });
await api.get('/api/cart');
```

- توکن CSRF به‌صورت lazy از `/api/auth/csrf` گرفته و در حافظه/کوکی نگه داشته می‌شود.
- `credentials: 'include'` برای ارسال کوکی سبد و نشست.
- خطاها به `toast` (sonner) با پیام فارسی نمایش داده می‌شوند.

## ۵. کتابخانه‌ی UI

کامپوننت‌های `src/components/ui/*` بر پایه‌ی **Radix UI** با استایل shadcn-style:
`button · input · label · select · checkbox · switch · slider · dialog · tabs · accordion · table · card · badge · separator · skeleton · textarea · tooltip · scroll-area · dropdown`.

دسترسی‌پذیری: ناوبری با کیبورد، `aria-*` روی Radix، کنتراست مناسب، `focus-visible` مشخص.

## ۶. ✅ اعتبارسنجی که واقعاً اجرا شده

- صفحه‌ی اصلی با `dir="rtl"` و عنوان فارسی رندر می‌شود (HTTP 200 + بررسی HTML).
- `next build` بدون خطا و بدون هشدار نوع، ۴۵ مسیر تولید شد.
- تمام صفحات کامپوننت‌های کلاینتی را در مرزهای مناسب (`'use client'`) جدا کرده‌اند تا رندر سرور حفظ شود.
