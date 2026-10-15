import { ok, readJson, route } from '@/lib/api';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { getCartToken } from '@/lib/cart-session';
import { ensureCart, addPhoneToCart, addModemToCart, setActivationItem, getCartView } from '@/lib/services/cart.service';
import { getCurrentUser } from '@/lib/auth/session';
import { badRequest } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const addItemSchema = z.object({
  productType: z.enum(['PHONE_NUMBER', 'MODEM', 'ACTIVATION_CODE']),
  phoneNumberId: z.string().cuid().optional(),
  modemId: z.string().cuid().optional(),
  operatorId: z.string().cuid().optional(),
  quantity: z.coerce.number().int().min(1).max(1000).optional(),
});

/** افزودن محصول به سبد خرید */
export const POST = route(async (request) => {
  await assertCsrf(request);
  const input = await readJson(request, addItemSchema);

  const token = await getCartToken({ create: true });
  const user = await getCurrentUser();
  const cart = await ensureCart(token, user?.id ?? null);

  switch (input.productType) {
    case 'PHONE_NUMBER': {
      if (!input.phoneNumberId) throw badRequest('شناسه شماره ارسال نشده است');
      await addPhoneToCart(cart.id, input.phoneNumberId);
      break;
    }
    case 'MODEM': {
      if (!input.modemId) throw badRequest('شناسه مودم ارسال نشده است');
      await addModemToCart(cart.id, input.modemId, input.quantity ?? 1);
      break;
    }
    case 'ACTIVATION_CODE': {
      if (!input.operatorId) throw badRequest('اپراتور انتخاب نشده است');
      await setActivationItem(cart.id, input.operatorId, input.quantity ?? 1);
      break;
    }
  }

  const view = await getCartView(cart.token, user?.id ?? null);
  return ok(view);
});
