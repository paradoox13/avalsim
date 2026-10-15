import { prisma } from './prisma';
import { cacheDel, cacheGet, cacheSet } from './cache';

export type SettingValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'SECRET';

export interface SettingDef {
  key: string;
  type: SettingValueType;
  group: string;
  label: string;
  description?: string;
  value: string;
  isPublic?: boolean;
}

/**
 * فهرست تنظیمات پیش‌فرض سیستم.
 * هر تنظیمی که اینجا نباشد در پنل ادمین نمایش داده نمی‌شود.
 */
export const SETTING_DEFS: SettingDef[] = [
  // --- اطلاعات سایت ---
  { key: 'site.name', type: 'STRING', group: 'site', label: 'نام فروشگاه', value: 'سیم‌شاپ', isPublic: true },
  { key: 'site.tagline', type: 'STRING', group: 'site', label: 'شعار سایت', value: 'مرجع خرید شماره، مودم و کد فعال‌سازی', isPublic: true },
  { key: 'site.description', type: 'STRING', group: 'site', label: 'توضیحات متا', value: 'خرید آنلاین شماره سیم‌کارت همراه اول، ایرانسل و رایتل، مودم و کد فعال‌سازی با پرداخت امن', isPublic: true },
  { key: 'site.logo', type: 'STRING', group: 'site', label: 'آدرس لوگو', value: '', isPublic: true },
  { key: 'site.phone', type: 'STRING', group: 'site', label: 'تلفن پشتیبانی', value: '021-00000000', isPublic: true },
  { key: 'site.email', type: 'STRING', group: 'site', label: 'ایمیل', value: 'info@shop.example.ir', isPublic: true },
  { key: 'site.address', type: 'STRING', group: 'site', label: 'نشانی', value: 'تهران', isPublic: true },
  { key: 'site.instagram', type: 'STRING', group: 'site', label: 'اینستاگرام', value: '', isPublic: true },
  { key: 'site.telegram', type: 'STRING', group: 'site', label: 'تلگرام', value: '', isPublic: true },

  // --- فروشگاه ---
  { key: 'shop.vatBasisPoints', type: 'NUMBER', group: 'shop', label: 'مالیات بر ارزش افزوده (basis point)', value: '0', description: '۹٪ = 900' },
  { key: 'shop.reservationMinutes', type: 'NUMBER', group: 'shop', label: 'مدت رزرو موقت شماره (دقیقه)', value: '15' },
  { key: 'shop.defaultCommission', type: 'NUMBER', group: 'shop', label: 'کمیسیون پیش‌فرض نماینده (basis point)', value: '500' },
  { key: 'shop.rondThreshold', type: 'NUMBER', group: 'shop', label: 'آستانه امتیاز رند بودن', value: '40' },
  { key: 'shop.minOrderAmount', type: 'NUMBER', group: 'shop', label: 'حداقل مبلغ سفارش (تومان)', value: '0' },
  { key: 'shop.activationMaxQty', type: 'NUMBER', group: 'shop', label: 'حداکثر تعداد کد فعال‌سازی در یک سفارش', value: '50' },
  { key: 'shop.requireNationalIdForActivation', type: 'BOOLEAN', group: 'shop', label: 'الزام کد ملی برای خرید کد فعال‌سازی', value: 'true' },
  { key: 'shop.shipToCustomerEnabled', type: 'BOOLEAN', group: 'shop', label: 'فعال‌بودن ارسال به آدرس مشتری', value: 'true' },

  // --- پرداخت ---
  { key: 'payment.activeGateway', type: 'STRING', group: 'payment', label: 'درگاه فعال', value: 'ZARINPAL', description: 'ZARINPAL | IDPAY | NEXTPAY' },
  { key: 'payment.sandbox', type: 'BOOLEAN', group: 'payment', label: 'حالت تست درگاه', value: 'true' },
  { key: 'payment.callbackBaseUrl', type: 'STRING', group: 'payment', label: 'آدرس پایه بازگشت از درگاه', value: '' , description: 'خالی = تشخیص خودکار از هدر Host'},
  { key: 'payment.zarinpal.merchantId', type: 'SECRET', group: 'payment', label: 'شناسه پذیرنده زرین‌پال', value: '' },
  { key: 'payment.idpay.apiKey', type: 'SECRET', group: 'payment', label: 'کلید API آیدی‌پی', value: '' },
  { key: 'payment.idpay.sandboxKey', type: 'SECRET', group: 'payment', label: 'کلید سندباکس آیدی‌پی', value: '6a7f99eb-7c20-4412-a972-6dfb7cd253a4' },
  { key: 'payment.nextpay.apiKey', type: 'SECRET', group: 'payment', label: 'کلید API نکست‌پی', value: '' },

  // --- پیامک ---
  { key: 'sms.enabled', type: 'BOOLEAN', group: 'sms', label: 'فعال‌بودن ارسال پیامک', value: 'true' },
  { key: 'sms.provider', type: 'STRING', group: 'sms', label: 'سرویس‌دهنده پیامک', value: 'KAVENEGAR', description: 'KAVENEGAR | MELIPAYAMAK' },
  { key: 'sms.kavenegar.apiKey', type: 'SECRET', group: 'sms', label: 'کلید API کاوه‌نگار', value: '' },
  { key: 'sms.kavenegar.sender', type: 'STRING', group: 'sms', label: 'شماره فرستنده کاوه‌نگار', value: '' },
  { key: 'sms.melipayamak.username', type: 'STRING', group: 'sms', label: 'نام کاربری ملی‌پیامک', value: '' },
  { key: 'sms.melipayamak.password', type: 'SECRET', group: 'sms', label: 'رمز ملی‌پیامک', value: '' },
  { key: 'sms.melipayamak.sender', type: 'STRING', group: 'sms', label: 'شماره فرستنده ملی‌پیامک', value: '' },
  { key: 'sms.adminMobiles', type: 'STRING', group: 'sms', label: 'موبایل ادمین‌ها برای اطلاع‌رسانی', value: '', description: 'با کاما جدا کنید' },

  // --- امنیت ---
  { key: 'security.requireAdminTwoFactor', type: 'BOOLEAN', group: 'security', label: 'الزام ورود دو مرحله‌ای برای ادمین', value: 'false' },
  { key: 'security.maintenanceMode', type: 'BOOLEAN', group: 'security', label: 'حالت تعمیرات', value: 'false' },
  { key: 'security.maxLoginAttempts', type: 'NUMBER', group: 'security', label: 'حداکثر تلاش ناموفق ورود', value: '5' },
  { key: 'security.lockoutMinutes', type: 'NUMBER', group: 'security', label: 'مدت قفل حساب (دقیقه)', value: '15' },

  // --- اکسل ---
  { key: 'excel.maxRows', type: 'NUMBER', group: 'excel', label: 'حداکثر سطر در هر ایمپورت', value: '5000' },
  { key: 'excel.maxFileSizeMb', type: 'NUMBER', group: 'excel', label: 'حداکثر حجم فایل (مگابایت)', value: '5' },
];

const DEFAULTS = new Map(SETTING_DEFS.map((d) => [d.key, d]));
export const SETTING_KEYS = SETTING_DEFS.map((d) => d.key);

function coerce(type: SettingValueType, raw: string): string | number | boolean | unknown {
  switch (type) {
    case 'NUMBER': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    case 'BOOLEAN':
      return raw === 'true' || raw === '1';
    case 'JSON':
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    default:
      return raw;
  }
}

/** خواندن یک تنظیم با پشتوانه‌ی کش (۶۰ ثانیه) */
export async function getSetting<T = string>(key: string): Promise<T> {
  const cacheKey = `setting:${key}`;
  const cached = await cacheGet<T>(cacheKey);
  if (cached !== null) return cached;

  const def = DEFAULTS.get(key);
  const row = await prisma.setting.findUnique({ where: { key } });
  const raw = row?.value ?? def?.value ?? '';
  const value = coerce((row?.type as SettingValueType) ?? def?.type ?? 'STRING', raw) as T;
  await cacheSet(cacheKey, value, 60);
  return value;
}

export async function getSettingString(key: string): Promise<string> {
  return String(await getSetting(key));
}

export async function getSettingNumber(key: string): Promise<number> {
  const value = await getSetting<number | string>(key);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getSettingBoolean(key: string): Promise<boolean> {
  return Boolean(await getSetting(key));
}

/** تنظیمات عمومی برای فرانت‌اند (بدون اسرار) */
export async function getPublicSettings(): Promise<Record<string, string>> {
  const cacheKey = 'settings:public';
  const cached = await cacheGet<Record<string, string>>(cacheKey);
  if (cached) return cached;

  const rows = await prisma.setting.findMany({ where: { isPublic: true } });
  const result: Record<string, string> = {};
  for (const def of SETTING_DEFS) {
    if (!def.isPublic) continue;
    const row = rows.find((r) => r.key === def.key);
    result[def.key] = row?.value ?? def.value;
  }
  await cacheSet(cacheKey, result, 120);
  return result;
}

export async function setSetting(key: string, value: string, userId?: string): Promise<void> {
  const def = DEFAULTS.get(key);
  if (!def) throw new Error(`تنظیم ناشناخته: ${key}`);
  await prisma.setting.upsert({
    where: { key },
    create: {
      key,
      value,
      type: def.type,
      group: def.group,
      label: def.label,
      description: def.description ?? null,
      isPublic: def.isPublic ?? false,
    },
    update: { value, updatedById: userId ?? null },
  });
  await cacheDel(`setting:${key}`);
  await cacheDel('settings:public');
}

/** همه‌ی تنظیمات (برای پنل ادمین). مقادیر SECRET ماسک می‌شوند. */
export async function getAllSettingsForAdmin(): Promise<
  Array<SettingDef & { stored: string; isSet: boolean }>
> {
  const rows = await prisma.setting.findMany();
  return SETTING_DEFS.map((def) => {
    const row = rows.find((r) => r.key === def.key);
    const stored = row?.value ?? def.value;
    const isSet = Boolean(row?.value);
    return {
      ...def,
      stored: def.type === 'SECRET' && isSet ? '********' : stored,
      isSet,
    };
  });
}
