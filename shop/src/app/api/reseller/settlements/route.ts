import { ok, paginated, readJson, route } from '@/lib/api';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireApprovedReseller } from '@/lib/guards';
import { createSettlement, listSettlements } from '@/lib/services/settlement.service';
import { tomanSchema } from '@/lib/validation/common';

export const dynamic = 'force-dynamic';

/** لیست تسویه‌های نماینده */
export const GET = route(async (request) => {
  const { resellerId } = await requireApprovedReseller();
  const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
  const result = await listSettlements({ resellerId, page, limit: 20 });
  return paginated(result.items, { page: result.page, limit: result.limit, total: result.total });
});

const requestSchema = z.object({
  amount: tomanSchema.optional(),
  note: z.string().max(500).optional(),
});

/** درخواست تسویه توسط نماینده */
export const POST = route(async (request) => {
  await assertCsrf(request);
  const { user, resellerId } = await requireApprovedReseller();
  const input = await readJson(request, requestSchema);
  const settlement = await createSettlement(
    { resellerId, amount: input.amount, note: input.note },
    { userId: user.id, roleKey: user.roleKey },
  );
  return ok(settlement);
});
