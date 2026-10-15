import { ok, readJson, route } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { modemUpdateSchema } from '@/lib/validation/product';
import { softDeleteModem, updateModem } from '@/lib/services/modem.service';

export const dynamic = 'force-dynamic';

export const PATCH = route(async (request, ctx: { params: { id: string } }) => {
  await assertCsrf(request);
  const user = await requireStaffUser('products.modems.write');
  const input = await readJson(request, modemUpdateSchema);
  const modem = await updateModem(ctx.params.id, input, {
    userId: user.id,
    roleKey: user.roleKey,
    permissions: user.permissions,
    resellerId: null,
  });
  return ok(modem);
});

export const DELETE = route(async (request, ctx: { params: { id: string } }) => {
  await assertCsrf(request);
  const user = await requireStaffUser('products.modems.delete');
  await softDeleteModem(ctx.params.id, {
    userId: user.id,
    roleKey: user.roleKey,
    permissions: user.permissions,
    resellerId: null,
  });
  return ok({ deleted: true });
});
