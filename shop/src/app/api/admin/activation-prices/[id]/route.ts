import { ok, route } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { deleteActivationPrice } from '@/lib/services/activation.service';

export const dynamic = 'force-dynamic';

export const DELETE = route(async (request, ctx: { params: { id: string } }) => {
  await assertCsrf(request);
  const user = await requireStaffUser('products.activation.write');
  await deleteActivationPrice(ctx.params.id, {
    userId: user.id,
    roleKey: user.roleKey,
    permissions: user.permissions,
    resellerId: null,
  });
  return ok({ deleted: true });
});
