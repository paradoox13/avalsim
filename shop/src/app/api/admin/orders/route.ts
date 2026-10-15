import { ok, paginated, readQuery, route } from '@/lib/api';
import { z } from 'zod';
import { requireStaffUser } from '@/lib/guards';
import { getOrdersReport } from '@/lib/services/report.service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(50),
});

/** لیست سفارش‌ها با فیلتر وضعیت و بازه‌ی تاریخ */
export const GET = route(async (request) => {
  await requireStaffUser('orders.read');
  const query = readQuery(request, querySchema);
  const result = await getOrdersReport(
    {
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    },
    query.page,
    query.limit,
  );
  return paginated(result.items, { page: result.page, limit: result.limit, total: result.total });
});
