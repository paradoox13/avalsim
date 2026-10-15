import { ok, paginated, readQuery, route } from '@/lib/api';
import { z } from 'zod';
import { requireApprovedReseller } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(30),
});

/** گزارش فروش نماینده (سطرهای فروخته‌شده) */
export const GET = route(async (request) => {
  const { userId } = await requireApprovedReseller();
  const query = readQuery(request, querySchema);

  const where = {
    resellerId: userId,
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  const [items, total, aggregate] = await Promise.all([
    prisma.orderItem.findMany({
      where,
      include: { order: { select: { orderNumber: true, customerName: true, status: true, paidAt: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.orderItem.count({ where }),
    prisma.orderItem.aggregate({
      where,
      _sum: { totalPrice: true, commissionAmount: true },
    }),
  ]);

  return paginated(items, { page: query.page, limit: query.limit, total });
});

