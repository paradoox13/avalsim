import { ok, readJson, route } from '@/lib/api';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { markSettlementPaid, rejectSettlement } from '@/lib/services/settlement.service';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  action: z.enum(['pay', 'reject']),
  trackingCode: z.string().max(64).optional(),
  note: z.string().max(500).optional(),
});

export const PATCH = route(async (request, ctx: { params: { id: string } }) => {
  await assertCsrf(request);
  const user = await requireStaffUser('resellers.settle');
  const input = await readJson(request, patchSchema);

  if (input.action === 'pay') {
    const settlement = await markSettlementPaid(
      ctx.params.id,
      { trackingCode: input.trackingCode, note: input.note },
      { userId: user.id, roleKey: user.roleKey },
    );
    return ok(settlement);
  }

  const settlement = await rejectSettlement(
    ctx.params.id,
    input.note ?? 'رد توسط مدیر',
    { userId: user.id, roleKey: user.roleKey },
  );
  return ok(settlement);
});
