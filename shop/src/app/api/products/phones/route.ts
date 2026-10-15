import { paginated, readQuery, route } from '@/lib/api';
import { phoneFilterSchema } from '@/lib/validation/product';
import { listPhones } from '@/lib/services/phone.service';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/api';
import { tooManyRequests } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * جستجوی پیشرفته‌ی شماره‌ها.
 * پارامترها: operators, minPrice, maxPrice, prefix, suffix, pattern, isRond,
 * isSequential, isRepeated, isPalindrome, digits, q, sort, page, limit
 */
export const GET = route(async (request) => {
  const ip = getClientIp(request);
  const limit = await rateLimit(`search:${ip}`, RATE_LIMITS.search.limit, RATE_LIMITS.search.window);
  if (!limit.ok) throw tooManyRequests();

  const filters = readQuery(request, phoneFilterSchema);
  const result = await listPhones(filters, { forStorefront: true });

  return paginated(
    result.items.map((phone) => ({
      id: phone.id,
      msisdn: phone.msisdn,
      prefix: phone.prefix,
      suffix: phone.suffix,
      price: phone.price,
      operator: {
        id: phone.operator.id,
        name: phone.operator.name,
        code: phone.operator.code,
        color: phone.operator.color,
      },
      isRond: phone.isRond,
      isSequential: phone.isSequential,
      isRepeated: phone.isRepeated,
      isPalindrome: phone.isPalindrome,
      rondScore: phone.rondScore,
      description: phone.description,
      views: phone.views,
      createdAt: phone.createdAt,
    })),
    { page: result.page, limit: result.limit, total: result.total },
  );
});
