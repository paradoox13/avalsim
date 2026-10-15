import { ok, readJson, route } from '@/lib/api';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { getCartToken } from '@/lib/cart-session';
import { ensureCart, removeCartItem, updateCartItemQuantity, getCartView } from '@/lib/services/cart.service';
import { getCurrentUser } from '@/lib/auth/session';
import { badRequest } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({ quantity: z.coerce.number().int().min(0).max(1000) });

/** تغییر تعداد یک آیتم سبد */
export const PATCH = route(async (request, ctx: { params: { id: string } }) => {
  await assertCsrf(request);
  const token = await getCartToken();
  if (!token) throw badRequest('سبد خرید یافت نشد');
  const user = await getCurrentUser();
  const cart = await ensureCart(token, user?.id ?? null);

  const { quantity } = await readJson(request, updateSchema);
  if (quantity === 0) await removeCartItem(cart.id, ctx.params.id);
  else await updateCartItemQuantity(cart.id, ctx.params.id, quantity);

  return ok(await getCartView(cart.token, user?.id ?? null));
});

/** حذف آیتم سبد */
export const DELETE = route(async (request, ctx: { params: { id: string } }) => {
  await assertCsrf(request);
  const token = await getCartToken();
  if (!token) throw badRequest('سبد خرید یافت نشد');
  const user = await getCurrentUser();
  const cart = await ensureCart(token, user?.id ?? null);
  await removeCartItem(cart.id, ctx.params.id);
  return ok(await getCartView(cart.token, user?.id ?? null));
});
