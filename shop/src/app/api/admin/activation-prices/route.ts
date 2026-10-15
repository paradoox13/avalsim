import { ok, readJson, route } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { activationPriceSchema } from '@/lib/validation/product';
import { upsertActivationPrice } from '@/lib/services/activation.service';
import { listOperatorsWithPrices } from '@/lib/services/operator.service';
import { prisma } from '@/lib/prisma';
import { requireStaffUser as guardRead } from '@/lib/guards';

export const dynamic = 'force-dynamic';

/** قیمت‌های کد فعال‌سازی به تفکیک اپراتور */
export const GET = route(async () => {
  await guardRead('products.activation.read');
  const [operators, prices] = await Promise.all([
    listOperatorsWithPrices(),
    prisma.activationCodePrice.findMany({ orderBy: [{ operatorId: 'asc' }, { minQty: 'asc' }] }),
  ]);
  return ok({ operators, prices });
});

/** ثبت یا ویرایش پله‌ی قیمت */
export const POST = route(async (request) => {
  await assertCsrf(request);
  const user = await requireStaffUser('products.activation.write');
  const input = await readJson(request, activationPriceSchema);
  const price = await upsertActivationPrice(
    {
      operatorId: input.operatorId,
      unitPrice: input.unitPrice,
      minQty: input.minQty,
      maxQty: input.maxQty ?? null,
      isActive: input.isActive ?? true,
      description: input.description || undefined,
    },
    { userId: user.id, roleKey: user.roleKey, permissions: user.permissions, resellerId: null },
  );
  return ok(price);
});
