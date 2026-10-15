import { ok, paginated, readQuery, route } from '@/lib/api';
import { z } from 'zod';
import { requireStaffUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.enum(['QUEUED', 'SENT', 'DELIVERED', 'FAILED']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(30),
});

/** لاگ پیامک‌های ارسالی */
export const GET = route(async (request) => {
  await requireStaffUser('sms.read');
  const query = readQuery(request, querySchema);
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { OR: [{ mobile: { contains: query.q } }, { message: { contains: query.q } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.smsLog.findMany({
      where,
      include: { order: { select: { orderNumber: true } }, user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.smsLog.count({ where }),
  ]);
  return paginated(items, { page: query.page, limit: query.limit, total });
});
