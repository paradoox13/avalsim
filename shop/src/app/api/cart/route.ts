import { ok, route } from '@/lib/api';
import { getCartToken } from '@/lib/cart-session';
import { getCartView } from '@/lib/services/cart.service';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** خلاصه‌ی سبد خرید جاری */
export const GET = route(async () => {
  const token = await getCartToken();
  const user = await getCurrentUser();
  const cart = await getCartView(token, user?.id ?? null);
  return ok(cart);
});
