import { paginated, readQuery, route } from '@/lib/api';
import { z } from 'zod';
import { requireStaffUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(30),
});

/** تاریخچه‌ی ایمپورت‌های اکسل */
export const GET = route(async (request) => {
  await requireStaffUser('reports.read');
  const query = readQuery(request, querySchema);
  const [items, total] = await Promise.all([
    prisma.excelImportLog.findMany({
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.excelImportLog.count(),
  ]);
  return paginated(items, { page: query.page, limit: query.limit, total });
});
