import { Prisma } from '@prisma/client';
import { patternToLike } from '../utils/pattern';
import type { PhoneFilterInput } from '../validation/product';

const PATTERN_ID_LIMIT = 20000; // سقف امن برای پیش‌فیلتر الگو

export interface PhoneWhereResult {
  where: Prisma.PhoneNumberWhereInput;
  orderBy: Prisma.PhoneNumberOrderByWithRelationInput[];
  page: number;
  limit: number;
}

/**
 * ساخت شرط Prisma از فیلترهای پیشرفته‌ی صفحه‌ی اصلی.
 *
 * نکته‌ی کارایی: فیلتر «الگوی عددی خاص» با کاراکتر `?` نیازمند LIKE با
 * وایل‌کارد تک‌رقمی است که Prisma از آن پشتیبانی نمی‌کند؛ بنابراین یک
 * پیش‌فیلتر پارامتری (`$queryRaw`) روی ستون msisdn انجام و شناسه‌ها
 * محدود به `PATTERN_ID_LIMIT` می‌شوند. سایر فیلترها با کوئری‌ساز امین Prisma اعمال می‌شوند.
 */
export async function buildPhoneWhere(
  filters: PhoneFilterInput,
  client: { $queryRaw: <T>(q: TemplateStringsArray, ...v: unknown[]) => Promise<T> },
): Promise<PhoneWhereResult> {
  const and: Prisma.PhoneNumberWhereInput[] = [];

  // وضعیت: به‌صورت پیش‌فرض فقط شماره‌های موجود نمایش داده می‌شوند
  if (filters.includeSold) {
    and.push({ status: { in: ['AVAILABLE', 'SOLD'] } });
  } else if (filters.onlyAvailable) {
    // شماره‌های رزروشده‌ای که مهلتشان تمام شده دوباره قابل مشاهده‌اند
    and.push({
      OR: [
        { status: 'AVAILABLE' },
        { status: 'RESERVED', reservedUntil: { lt: new Date() } },
      ],
    });
  }
  and.push({ deletedAt: null });

  // اپراتور
  if (filters.operators?.length) {
    and.push({
      OR: [
        { operator: { code: { in: filters.operators } } },
        { operator: { slug: { in: filters.operators } } },
      ],
    });
  }

  // بازه قیمت
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    and.push({
      price: {
        ...(filters.minPrice !== undefined ? { gte: BigInt(filters.minPrice) } : {}),
        ...(filters.maxPrice !== undefined ? { lte: BigInt(filters.maxPrice) } : {}),
      },
    });
  }

  // پیش‌شماره: پشتیبانی از الگو مثل 091* با تبدیل به بازه‌ی متنی
  if (filters.prefix) {
    const prefix = filters.prefix.replace(/\D/g, '');
    if (prefix) and.push({ prefix: { startsWith: prefix.slice(0, 4) } });
  }

  // پسوند
  if (filters.suffix) {
    const suffix = filters.suffix.replace(/\D/g, '');
    if (suffix) and.push({ suffix: { endsWith: suffix } });
  }

  // ویژگی‌های شماره
  if (filters.isRond) and.push({ isRond: true });
  if (filters.isSequential) and.push({ isSequential: true });
  if (filters.isRepeated) and.push({ isRepeated: true });
  if (filters.isPalindrome) and.push({ isPalindrome: true });
  if (filters.digits) and.push({ length: filters.digits });
  if (filters.repeatCount) {
    const analysis = await client.$queryRaw<Array<{ msisdn: string }>>`
      SELECT msisdn FROM "PhoneNumber"
      WHERE (status = 'AVAILABLE' OR (status = 'RESERVED' AND "reservedUntil" < NOW()))
        AND "deletedAt" IS NULL
        AND length(msisdn) - length(replace(msisdn, substring(msisdn, 5, 1), '')) >= ${filters.repeatCount}
      LIMIT ${PATTERN_ID_LIMIT}
    `;
    and.push({ msisdn: { in: analysis.map((a) => a.msisdn) } });
  }

  // نماینده
  if (filters.resellerId) and.push({ resellerId: filters.resellerId });

  // جستجوی سریع
  if (filters.q) {
    const raw = filters.q.trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 3) {
      and.push({ OR: [{ msisdn: { contains: digits } }, { description: { contains: raw } }] });
    } else {
      and.push({ description: { contains: raw } });
    }
  }

  // الگوی عددی خاص
  if (filters.pattern && filters.pattern.trim()) {
    const like = patternToLike(filters.pattern);
    const rows = await client.$queryRaw<Array<{ msisdn: string }>>`
      SELECT msisdn FROM "PhoneNumber"
      WHERE msisdn LIKE ${like} AND "deletedAt" IS NULL
        AND (status = 'AVAILABLE' OR (status = 'RESERVED' AND "reservedUntil" < NOW()))
      LIMIT ${PATTERN_ID_LIMIT}
    `;
    and.push({ msisdn: { in: rows.map((r) => r.msisdn) } });
  }

  const orderBy = resolveOrderBy(filters.sort);

  return {
    where: and.length ? { AND: and } : {},
    orderBy,
    page: filters.page,
    limit: filters.limit,
  };
}

export function resolveOrderBy(
  sort: PhoneFilterInput['sort'],
): Prisma.PhoneNumberOrderByWithRelationInput[] {
  switch (sort) {
    case 'cheapest':
      return [{ price: 'asc' }, { createdAt: 'desc' }];
    case 'expensive':
      return [{ price: 'desc' }, { createdAt: 'desc' }];
    case 'popular':
      return [{ views: 'desc' }, { createdAt: 'desc' }];
    case 'rond':
      return [{ rondScore: 'desc' }, { price: 'asc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }];
  }
}

/** ساخت پارامترهای کوئری‌استرینگ از فیلترها (برای صفحه‌بندی و اشتراک لینک) */
export function buildPhoneQueryString(filters: Partial<PhoneFilterInput>): string {
  const params = new URLSearchParams();
  const set = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === false || value === '') return;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
      return;
    }
    params.set(key, String(value));
  };
  set('operators', filters.operators);
  set('minPrice', filters.minPrice);
  set('maxPrice', filters.maxPrice);
  set('prefix', filters.prefix);
  set('suffix', filters.suffix);
  set('pattern', filters.pattern);
  set('isRond', filters.isRond);
  set('isSequential', filters.isSequential);
  set('isRepeated', filters.isRepeated);
  set('isPalindrome', filters.isPalindrome);
  set('digits', filters.digits);
  set('q', filters.q);
  if (filters.sort && filters.sort !== 'newest') set('sort', filters.sort);
  if (filters.page && filters.page > 1) set('page', filters.page);
  set('resellerId', filters.resellerId);
  return params.toString();
}
