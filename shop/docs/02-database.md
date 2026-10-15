# ۰۲ — طراحی دیتابیس

مشاهده‌ی طرح: [`prisma/schema.prisma`](../prisma/schema.prisma) · مهاجرت‌ها: `prisma/migrations/`

## ۱. نمودار موجودیت‌ها (متن)

```
User ──1:1── ResellerProfile ──1:N── PhoneNumber / Modem / Settlement / OrderItem
 │
 ├─N:M─ Role ──N:M── Permission
 │
 ├─1:N── Order ──1:N── OrderItem ──(اختیاری)── PhoneNumber / Modem
 │              └─1:N── Payment
 │
 ├─1:N── Cart ──1:N── CartItem
 └─1:N── AuditLog / SmsLog / LoginAttempt

Operator ──1:N── OperatorPrefix
Operator ──1:N── ActivationCodePrice   (قیمت پله‌ای)
Operator ──1:N── PhoneNumber

Setting · ContentPage · ContactMessage · ExcelImportLog · Counter
```

## ۲. مدل‌های اصلی

### `PhoneNumber` — هسته‌ی فروشگاه
| فیلد | نوع | توضیح |
|---|---|---|
| `msisdn` | `String @unique` | شماره‌ی کامل ۱۱ رقمی — **کلید یکتایی سراسری** |
| `prefix` / `middle` / `suffix` / `length` | `String`/`Int` | اجزای شماره برای فیلتر سریع |
| `operatorId` | `FK Operator` | تشخیص خودکار از پیش‌شماره |
| `price` | `BigInt` | تومان |
| `status` | `PhoneStatus` | `AVAILABLE · RESERVED · SOLD · INACTIVE` |
| `ownerType` | `OwnerType` | `PLATFORM · RESELLER` |
| `resellerId` | `FK User?` | نماینده‌ی ثبت‌کننده |
| `isRond/isSequential/isRepeated/isPalindrome` | `Boolean` | تحلیل عددی ذخیره‌شده |
| `rondScore` | `Int` | امتیاز زیبایی ۰..۱۰۰ |
| `reservedByToken` / `reservedAt` / `reservedUntil` | | قفل موقت خرید |
| `soldOrderId` | `FK Order?` | سفارش فروش |
| `views` | `Int` | محبوبیت |

**ایندکس‌ها:** `(status, operatorId)`، `(status, price)`، `(prefix, suffix)`، `(reservedUntil)`.

چرا `msisdn` یکتا در کل سیستم است؟ تا یک شماره هرگز دوبار — نه توسط پلتفرم و نه توسط دو نماینده‌ی مختلف — ثبت نشود.

### `Order` و `OrderItem`
- `orderNumber` یکتای خوانا: `SH-14030812-000123` (از جدول `Counter` تولید می‌شود).
- `trackingCode` یکتای ۱۰ کاراکتری برای پیگیری مهمان.
- `status` از `OrderStatus`: `PENDING_PAYMENT → PAID → PROCESSING → AWAITING_PHYSICAL_DELIVERY → SHIPPED → DELIVERED` و `FAILED/CANCELED/REFUNDED`.
- `subtotal + discount + vat + shipping + total` همه `BigInt` تومان.
- `OrderItem` نوع محصول، عنوان اسنپ‌شات، قیمت واحد، تعداد، `commissionRate` و `commissionAmount` را نگه می‌دارد (تاریخ‌نگاری مالی).

### `Payment`
- `authority @unique` (شناسه‌ی درگاه)، `status` از `PaymentStatus`، `requestPayload`/`verifyPayload` به‌صورت `Json`.
- `refId` (شماره پیگیری درگاه) و `cardPan` برای نمایش به مشتری.

### قیمت پله‌ای کد فعال‌سازی — `ActivationCodePrice`
```
operatorId + minQty + maxQty  →  unitPrice
مثال همراه اول: [1..9]=2,500,000  [10..49]=2,300,000  [50..∞]=2,100,000
```
منطق انتخاب پله: `src/lib/services/activation.service.ts` (`quoteActivation`) — خالص و تست‌شده.

### `ExcelImportLog`
هر ایمپورت: `status` (`PENDING/PROCESSING/COMPLETED/FAILED/PARTIAL`)، `totalRows`، `successRows`، `failedRows`، `errors Json` و مسیر فایل. برای پاسخ‌گویی به نماینده که «چند ردیف رد شد و چرا».

### `Setting`
`key` یکتا، `type` (`STRING|NUMBER|BOOLEAN|JSON|SECRET`)، `group`، `isPublic`، `value`.
کلیدهای `SECRET` در `getAllSettingsForAdmin` ماسک می‌شوند و در `getPublicSettings` هرگز برنمی‌گردند.

### `AuditLog` و `SmsLog`
- Audit: `action`، `entity`، `entityId`، `before`/`after` (Json)، `userId`، `ip`، `userAgent`.
- Sms: `mobile`، `message`، `template`، `provider`، `status`، `providerMessageId`، `cost`، `response`، `errorMessage`.

### `LoginAttempt` و `Counter`
- `LoginAttempt`: برای قفل حساب پس از `security.maxLoginAttempts` (پیش‌فرض ۵) در بازه‌ی `security.lockoutMinutes` (۱۵).
- `Counter`: تولید اتمی شماره سفارش.

## ۳. چرا این ساختار نرمال و مقیاس‌پذیر است؟

1. **جداسازی مالکیت محصول** (`ownerType` + `resellerId`) — یک جدول واحد برای محصول پلتفرم و نماینده، با فیلتر دقیق.
2. **اسنپ‌شات مالی در `OrderItem`** — تغییر قیمت بعدی، فاکتور قدیمی را عوض نمی‌کند.
3. **`Json` برای payload درگاه/اکسل** — بدون نیاز به جدول واسط برای داده‌ی ناهمگون، ولی ساخت‌یافته در سطح برنامه.
4. **تمام حجم پول `BigInt`** — بدون خطای شناور.

## ۴. چرخه‌ی وضعیت شماره

```
AVAILABLE ──(checkout)──▶ RESERVED ──(پرداخت موفق)──▶ SOLD
    ▲                         │
    └────(انقضا/لغو)──────────┘
```
آزادسازی رزروهای منقضی در `releaseExpiredReservations` و از طریق `/api/cron/maintenance`.
