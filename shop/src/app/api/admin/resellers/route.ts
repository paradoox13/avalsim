import { ok, paginated, readQuery, route } from '@/lib/api';
import { z } from 'zod';
import { requireStaffUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'SUSPENDED']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(30),
});

/** لیست نمایندگان با آمار فروش */
export const GET = route(async (request) => {
  await requireStaffUser('resellers.read');
  const query = readQuery(request, querySchema);

  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { shopName: { contains: query.q } },
            { code: { contains: query.q } },
            { user: { is: { fullName: { contains: query.q } } } },
            { user: { is: { phone: { contains: query.q } } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.resellerProfile.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true, status: true, lastLoginAt: true } },
        _count: { select: { settlements: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.resellerProfile.count({ where }),
  ]);

  // تعداد محصولات هر نماینده
  const withCounts = await Promise.all(
    items.map(async (profile) => {
      const [phones, modems] = await Promise.all([
        prisma.phoneNumber.count({ where: { resellerId: profile.userId, deletedAt: null } }),
        prisma.modem.count({ where: { resellerId: profile.userId, deletedAt: null } }),
      ]);
      return { ...profile, counts: { phones, modems } };
    }),
  );

  return paginated(withCounts, { page: query.page, limit: query.limit, total });
});
