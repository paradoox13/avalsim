# ۰۵ — پنل نمایندگان

مسیر: `/reseller` · دسترسی: نقش `RESELLER` · کد: `src/app/reseller/*`, `src/components/reseller/*`, `src/lib/services/reseller.service.ts`

## ۱. جریان ثبت‌نام

```
/reseller/register  →  POST /api/auth/reseller/register
    → ساخت User با نقش RESELLER + ResellerProfile(status=PENDING)
    → ادمین در /admin/resellers تأیید می‌کند (status=APPROVED)
    → نماینده می‌تواند وارد شود و محصول ثبت/فروش کند
```
تا زمان تأیید، ورود نماینده به پنل مسدود است (`reseller.status !== 'APPROVED'`).

## ۲. امکانات

| صفحه | فایل | امکانات |
|---|---|---|
| داشبورد | `/reseller` | کارت‌های آماری: موجودی شماره، موجودی مودم، فروش کل، مانده حساب، سفارش‌های اخیر |
| شماره‌ها | `/reseller/phones` | لیست + **ثبت دستی** + ویرایش/حذف (فقط وضعیت موجود) |
| مودم‌ها | `/reseller/modems` | همان امکانات برای مودم |
| ایمپورت اکسل | `/reseller/import` | آپلود فایل، گزارش خطاها، دانلود قالب |
| گزارش فروش | `/reseller/reports` | فروش به تفکیک محصول/تاریخ + کمیسیون + خروجی اکسل |
| تسویه‌ها | `/reseller/settlements` | مانده حساب + درخواست تسویه + تاریخچه |

## ۳. قواعد مالکیت و امنیت

- همه‌ی کوئری‌ها با `resellerId = user.resellerId` محدود می‌شوند → نماینده هرگز محصول نماینده‌ی دیگر را نمی‌بیند یا تغییر نمی‌دهد.
- **ویرایش/حذف فقط وقتی `status = AVAILABLE`** است؛ محصول رزرو‌شده یا فروخته‌شده قفل است:
```ts
const updated = await prisma.phoneNumber.updateMany({
  where: { id, resellerId, status: 'AVAILABLE' },   // ← شرط اتمی
  data: { price, description },
});
if (updated.count === 0) throw conflict('این محصول قابل ویرایش نیست');
```
- ثبت شماره‌ی تکراری رد می‌شود (کلید یکتای `msisdn` در سراسر سیستم).
- هر ایمپورت اکسل در `ExcelImportLog` با تعداد موفق/ناموفق و `errors Json` ثبت می‌شود.
- نماینده دسترسی `products.phones.*` و `products.modems.*` و `reports.read` را دارد (نه تسویه‌ی خودمختار؛ تسویه با تأیید ادمین انجام می‌شود).

## ۴. کمیسیون و تسویه

- هنگام فروش، `commissionRate` روی `OrderItem` ثبت و `commissionAmount` محاسبه می‌شود.
- مبلغ به `ResellerProfile.balance` واریز و در `ResellerProfile.totalSales` انباشته می‌شود.
- نماینده درخواست تسویه می‌دهد → ادمین در `/admin/settlements` تأیید/پرداخت می‌کند → `Settlement` با وضعیت به‌روزرسانی و `balance` کاهش می‌یابد.
- تمامی این عملیات در تراکنش دیتابیس انجام می‌شود (بدون واریز مضاعف؛ تست idempotent در `tests/integration/checkout.test.ts`).
