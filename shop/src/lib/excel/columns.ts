/**
 * تعریف قالب اکسل و نام‌های معتبر ستون‌ها.
 * پذیرش چند نام برای هر ستون باعث می‌شود فایل‌های تولیدشده توسط نرم‌افزارهای
 * مختلف (اکسل، گوگل‌شیت، نرم‌افزارهای دفتری) بدون تغییر قبول شوند.
 */
import { normalizePersianText } from '../utils/persian';

export interface ColumnDef {
  key: string;
  title: string;
  width: number;
  required: boolean;
  aliases: string[];
  example: string | number;
  note?: string;
}

export const PHONE_COLUMNS: ColumnDef[] = [
  {
    key: 'msisdn',
    title: 'شماره موبایل',
    width: 18,
    required: true,
    aliases: ['msisdn', 'phone', 'mobile', 'number', 'شماره', 'شماره موبایل', 'موبایل', 'شماره تماس'],
    example: '09121234567',
    note: 'مثال: 09121234567 یا ۰۹۱۲۱۲۳۴۵۶۷',
  },
  {
    key: 'price',
    title: 'قیمت (تومان)',
    width: 16,
    required: true,
    aliases: ['price', 'قیمت', 'قیمت (تومان)', 'مبلغ', 'قیمت فروش'],
    example: 2500000,
  },
  {
    key: 'operator',
    title: 'اپراتور',
    width: 14,
    required: false,
    aliases: ['operator', 'اپراتور', 'همراه اول', 'ایرانسل'],
    example: 'همراه اول',
    note: 'خالی بماند، به‌صورت خودکار از پیش‌شماره تشخیص داده می‌شود',
  },
  {
    key: 'description',
    title: 'توضیحات',
    width: 32,
    required: false,
    aliases: ['description', 'توضیحات', 'یادداشت', 'note'],
    example: 'شماره رند',
  },
];

export const MODEM_COLUMNS: ColumnDef[] = [
  {
    key: 'brand',
    title: 'برند',
    width: 16,
    required: true,
    aliases: ['brand', 'برند', 'سازنده'],
    example: 'Huawei',
  },
  {
    key: 'model',
    title: 'مدل',
    width: 18,
    required: true,
    aliases: ['model', 'مدل'],
    example: 'B315s-22',
  },
  {
    key: 'title',
    title: 'عنوان محصول',
    width: 34,
    required: true,
    aliases: ['title', 'عنوان', 'عنوان محصول', 'نام محصول'],
    example: 'مودم LTE هوآوی B315s-22',
  },
  {
    key: 'price',
    title: 'قیمت (تومان)',
    width: 16,
    required: true,
    aliases: ['price', 'قیمت', 'قیمت (تومان)', 'مبلغ'],
    example: 3200000,
  },
  {
    key: 'stock',
    title: 'موجودی',
    width: 10,
    required: true,
    aliases: ['stock', 'موجودی', 'تعداد'],
    example: 5,
  },
  {
    key: 'warranty',
    title: 'گارانتی',
    width: 18,
    required: false,
    aliases: ['warranty', 'گارانتی', 'ضمانت'],
    example: '۱۸ ماه شرکتی',
  },
  {
    key: 'imageUrl',
    title: 'آدرس تصویر',
    width: 30,
    required: false,
    aliases: ['imageurl', 'image', 'تصویر', 'آدرس تصویر', 'عکس'],
    example: 'https://example.com/modem.jpg',
  },
  {
    key: 'description',
    title: 'توضیحات',
    width: 34,
    required: false,
    aliases: ['description', 'توضیحات', 'یادداشت'],
    example: 'قابل استفاده با سیم‌کارت همراه اول',
  },
];

export type TemplateType = 'PHONE_NUMBERS' | 'MODEMS';

export function columnsFor(type: TemplateType): ColumnDef[] {
  return type === 'PHONE_NUMBERS' ? PHONE_COLUMNS : MODEM_COLUMNS;
}

function normalizeHeader(input: string): string {
  return normalizePersianText(input)
    .toLowerCase()
    .replace(/[_\-\s()*]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک');
}

/**
 * نگاشت سرستون‌های فایل کاربر به کلید داخلی.
 * خروجی: کلید داخلی → شماره‌ی ستون (۱ مبنا)
 */
export function mapHeaders(headerRow: string[], type: TemplateType): Map<string, number> {
  const columns = columnsFor(type);
  const result = new Map<string, number>();
  const normalizedHeaders = headerRow.map((h) => normalizeHeader(String(h ?? '')));

  for (const column of columns) {
    const candidates = [column.title, column.key, ...column.aliases].map(normalizeHeader);
    const index = normalizedHeaders.findIndex((h) => h.length > 0 && candidates.includes(h));
    if (index >= 0) result.set(column.key, index + 1);
  }
  return result;
}

export function missingRequiredColumns(mapped: Map<string, number>, type: TemplateType): string[] {
  return columnsFor(type)
    .filter((c) => c.required && !mapped.has(c.key))
    .map((c) => c.title);
}
