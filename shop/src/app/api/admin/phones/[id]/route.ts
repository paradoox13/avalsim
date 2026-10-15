import { ok, readJson, route } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { phoneUpdateSchema } from '@/lib/validation/product';
import { softDeletePhone, updatePhone } from '@/lib/services/phone.service';

export const dynamic = 'force-dynamic';

export const PATCH = route(async (request, ctx: { params: { id: string } }) => {
  await assertCsrf(request);
  const user = await requireStaffUser('products.phones.write');
  const input = await readJson(request, phoneUpdateSchema);
  const phone = await updatePhone(ctx.params.id, input, {
    userId: user.id,
    roleKey: user.roleKey,
    permissions: user.permissions,
    resellerId: null,
  });
  return ok(phone);
});

export const DELETE = route(async (request, ctx: { params: { id: string } }) => {
  await assertCsrf(request);
  const user = await requireStaffUser('products.phones.delete');
  await softDeletePhone(ctx.params.id, {
    userId: user.id,
    roleKey: user.roleKey,
    permissions: user.permissions,
    resellerId: null,
  });
  return ok({ deleted: true });
});
