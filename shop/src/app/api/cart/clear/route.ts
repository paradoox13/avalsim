import { ok, route } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { getCartToken } from '@/lib/cart-session';
import { clearCart, ensureCart } from '@/lib/services/cart.service';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const POST = route(async (request) => {
  await assertCsrf(request);
  const token = await getCartToken();
  const user = await getCurrentUser();
  const cart = await ensureCart(token, user?.id ?? null);
  await clearCart(cart.id);
  return ok({ cleared: true });
});
