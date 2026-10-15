import { describe, expect, it, vi } from 'vitest';
import { buildPhoneQueryString, resolveOrderBy } from '@/lib/filters/phone-filter';
import { phoneFilterSchema } from '@/lib/validation/product';

/** JSON.stringify روی BigInt خطا می‌دهد؛ برای تست از این تبدیل امن استفاده می‌کنیم */
function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

/** کلاینت جعلی Prisma برای تست کوئری‌ساز خالص */
const fakeClient = {
  $queryRaw: vi.fn().mockResolvedValue([]),
};

describe('کوئری‌ساز فیلتر شماره', () => {
  it('به‌صورت پیش‌فرض فقط شماره‌های موجود را برمی‌گرداند', async () => {
    const filters = phoneFilterSchema.parse({});
    const { buildPhoneWhere } = await import('@/lib/filters/phone-filter');
    const result = await buildPhoneWhere(filters, fakeClient);
    const conditions = safeStringify(result.where);
    expect(conditions).toContain('AVAILABLE');
    expect(conditions).toContain('deletedAt');
  });

  it('فیلتر اپراتور، بازه قیمت و ویژگی‌ها را اعمال می‌کند', async () => {
    const filters = phoneFilterSchema.parse({
      operators: 'MCI,IRANCELL',
      minPrice: '1000000',
      maxPrice: '50000000',
      isRond: 'true',
      isSequential: 'true',
      prefix: '0912',
      suffix: '4567',
      digits: '11',
    });
    const { buildPhoneWhere } = await import('@/lib/filters/phone-filter');
    const result = await buildPhoneWhere(filters, fakeClient);
    const conditions = safeStringify(result.where);
    expect(conditions).toContain('MCI');
    expect(conditions).toContain('IRANCELL');
    expect(conditions).toContain('isRond');
    expect(conditions).toContain('isSequential');
    expect(conditions).toContain('0912');
    expect(conditions).toContain('4567');
  });

  it('الگوی عددی را به کوئری امن تبدیل می‌کند', async () => {
    const filters = phoneFilterSchema.parse({ pattern: '0912???1111' });
    const { buildPhoneWhere } = await import('@/lib/filters/phone-filter');
    await buildPhoneWhere(filters, fakeClient);
    expect(fakeClient.$queryRaw).toHaveBeenCalled();
  });

  it('مرتب‌سازی‌ها به ترتیب صحیح نگاشت می‌شوند', () => {
    expect(resolveOrderBy('cheapest')[0]).toEqual({ price: 'asc' });
    expect(resolveOrderBy('expensive')[0]).toEqual({ price: 'desc' });
    expect(resolveOrderBy('popular')[0]).toEqual({ views: 'desc' });
    expect(resolveOrderBy('rond')[0]).toEqual({ rondScore: 'desc' });
    expect(resolveOrderBy('newest')[0]).toEqual({ createdAt: 'desc' });
  });

  it('ساخت کوئری‌استرینگ قابل اشتراک', () => {
    const query = buildPhoneQueryString({
      operators: ['MCI'],
      minPrice: 1000,
      isRond: true,
      sort: 'cheapest',
      page: 2,
    });
    expect(query).toContain('operators=MCI');
    expect(query).toContain('minPrice=1000');
    expect(query).toContain('isRond=true');
    expect(query).toContain('sort=cheapest');
    expect(query).toContain('page=2');
  });

  it('مقادیر پیش‌فرض در کوئری‌استرینگ حذف می‌شوند', () => {
    const query = buildPhoneQueryString({ sort: 'newest', page: 1, isRond: false });
    expect(query).not.toContain('sort');
    expect(query).not.toContain('page');
    expect(query).not.toContain('isRond');
  });
});
