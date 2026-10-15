/**
 * تشخیص خودکار اپراتور از روی پیش‌شماره.
 *
 * منبع حقیقت در دیتابیس است (جدول OperatorPrefix) و ادمین می‌تواند آن را
 * از پنل مدیریت به‌روزرسانی کند؛ نقشه‌ی ثابت زیر فقط به‌عنوان seed و
 * fallback آفلاین استفاده می‌شود و باید با آخرین مصوبه‌ی رگولاتوری تطبیق داده شود.
 */

export const OPERATOR_CODES = {
  MCI: 'MCI',
  IRANCELL: 'IRANCELL',
  RIGHTEL: 'RIGHTEL',
  APTEL: 'APTEL',
  SHATEL: 'SHATEL',
  SAMANTEL: 'SAMANTEL',
  TALIA: 'TALIA',
  OTHER: 'OTHER',
} as const;

export type OperatorCode = (typeof OPERATOR_CODES)[keyof typeof OPERATOR_CODES];

export interface OperatorSeed {
  code: string;
  name: string;
  nameEn: string;
  slug: string;
  color: string;
  prefixes: string[];
}

/** داده‌ی اولیه‌ی اپراتورها — از پنل ادمین قابل ویرایش است */
export const OPERATOR_SEED: OperatorSeed[] = [
  {
    code: 'MCI',
    name: 'همراه اول',
    nameEn: 'MCI',
    slug: 'mci',
    color: '#1e88e5',
    prefixes: [
      '0910', '0911', '0912', '0913', '0914', '0915', '0916', '0917', '0918', '0919',
      '0990', '0991', '0992', '0993', '0994', '0996', '0901', '0902', '0903',
    ],
  },
  {
    code: 'IRANCELL',
    name: 'ایرانسل',
    nameEn: 'Irancell',
    slug: 'irancell',
    color: '#ffca28',
    prefixes: ['0930', '0933', '0935', '0936', '0937', '0938', '0939', '0905', '0931'],
  },
  {
    code: 'RIGHTEL',
    name: 'رایتل',
    nameEn: 'Rightel',
    slug: 'rightel',
    color: '#8e24aa',
    prefixes: ['0920', '0921', '0922'],
  },
  {
    code: 'TALIA',
    name: 'تالیا',
    nameEn: 'Talia',
    slug: 'talia',
    color: '#43a047',
    prefixes: ['0932'],
  },
  {
    code: 'APTEL',
    name: 'آپتل',
    nameEn: 'Aptel',
    slug: 'aptel',
    color: '#fb8c00',
    prefixes: ['0995'],
  },
  {
    code: 'SHATEL',
    name: 'شاتل موبایل',
    nameEn: 'Shatel Mobile',
    slug: 'shatel',
    color: '#e53935',
    prefixes: ['0998', '0999'],
  },
  {
    code: 'SAMANTEL',
    name: 'سامان‌تل',
    nameEn: 'Samantel',
    slug: 'samantel',
    color: '#00897b',
    prefixes: ['0997'],
  },
];

/** نگاشت پیش‌شماره → کد اپراتور (fallback آفلاین) */
export function buildPrefixMap(seeds: OperatorSeed[] = OPERATOR_SEED): Map<string, string> {
  const map = new Map<string, string>();
  for (const op of seeds) {
    for (const p of op.prefixes) map.set(p, op.code);
  }
  return map;
}

const PREFIX_MAP = buildPrefixMap();

/**
 * نرمال‌سازی شماره‌ی موبایل ایران به شکل استاندارد «09XXXXXXXXX» (۱۱ رقم).
 * ورودی‌های پذیرفته‌شده: +98912…, 0098912…, 98912…, 9123456789, 0912-345-6789, ارقام فارسی
 * در صورت نامعتبر بودن `null` برمی‌گرداند.
 */
export function normalizeMsisdn(input: string): string | null {
  if (!input) return null;
  let digits = input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');

  if (digits.startsWith('0098')) digits = digits.slice(4);
  else if (digits.startsWith('98') && digits.length > 10) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('9')) digits = `0${digits}`;
  if (digits.length === 10 && digits.startsWith('9') === false) return null;
  if (!/^09\d{9}$/.test(digits)) return null;
  return digits;
}

export function extractPrefix(msisdn: string): string {
  return msisdn.slice(0, 4);
}

export function extractSuffix(msisdn: string, size = 4): string {
  return msisdn.slice(-size);
}

export function extractMiddle(msisdn: string): string {
  return msisdn.slice(4, -4);
}

/** تشخیص اپراتور؛ در صورت نبود در نقشه، 'OTHER' */
export function detectOperatorCode(msisdn: string, prefixMap: Map<string, string> = PREFIX_MAP): string {
  const normalized = normalizeMsisdn(msisdn);
  if (!normalized) return OPERATOR_CODES.OTHER;
  return prefixMap.get(extractPrefix(normalized)) ?? OPERATOR_CODES.OTHER;
}

/** اعتبارسنجی سریع شماره موبایل ایران */
export function isValidIranianMobile(input: string): boolean {
  return normalizeMsisdn(input) !== null;
}
