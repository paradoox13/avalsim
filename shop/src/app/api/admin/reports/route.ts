import { ok, readQuery, route } from '@/lib/api';
import { z } from 'zod';
import { requireStaffUser } from '@/lib/guards';
import {
  getOperatorSalesReport,
  getOrdersReport,
  getResellerSalesReport,
  buildOrderExportRows,
} from '@/lib/services/report.service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  type: z.enum(['orders', 'operators', 'resellers']).catch('orders'),
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(200).catch(50),
});

/** گزارش‌های خرید و فروش */
export const GET = route(async (request) => {
  await requireStaffUser('reports.read');
  const query = readQuery(request, querySchema);
  const range = {
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    status: query.status,
  };

  if (query.type === 'operators') {
    return ok({ type: 'operators', rows: await getOperatorSalesReport(range) });
  }
  if (query.type === 'resellers') {
    return ok({ type: 'resellers', rows: await getResellerSalesReport(range) });
  }

  const result = await getOrdersReport(range, query.page, query.limit);
  return ok({
    type: 'orders',
    rows: result.items,
    summary: result.summary,
    meta: { page: result.page, limit: result.limit, total: result.total },
    exportPreview: buildOrderExportRows(result.items).slice(0, 1),
  });
});
