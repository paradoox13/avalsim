import { ok, paginated, readJson, readQuery, route } from '@/lib/api';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { tomanSchema } from '@/lib/validation/common';
import { createSettlement, listSettlements } from '@/lib/services/settlement.service';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  resellerId: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'REJECTED']).optional(),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(30),
});

export const GET = route(async (request) => {
  await requireStaffUser('resellers.read');
  const query = readQuery(request, querySchema);
  const result = await listSettlements(query);
  return paginated(result.items, { page: result.page, limit: result.limit, total: result.total });
});

const createSchema = z.object({
  resellerId: z.string().cuid(),
  amount: tomanSchema.optional(),
  note: z.string().max(500).optional(),
});

/** ثبت تسویه برای نماینده */
export const POST = route(async (request) => {
  await assertCsrf(request);
  const user = await requireStaffUser('resellers.settle');
  const input = await readJson(request, createSchema);
  const settlement = await createSettlement(
    { resellerId: input.resellerId, amount: input.amount, note: input.note },
    { userId: user.id, roleKey: user.roleKey },
  );
  return ok(settlement);
});
