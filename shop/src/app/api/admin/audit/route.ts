import { paginated, readQuery, route } from '@/lib/api';
import { z } from 'zod';
import { requireStaffUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  entity: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(200).catch(50),
});

/** لاگ تغییرات سیستم */
export const GET = route(async (request) => {
  await requireStaffUser('audit.read');
  const query = readQuery(request, querySchema);
  const where = {
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { fullName: true, roleKey: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return paginated(items, { page: query.page, limit: query.limit, total });
});
