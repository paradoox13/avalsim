import { ok, paginated, readJson, readQuery, route } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { modemCreateSchema, modemFilterSchema } from '@/lib/validation/product';
import { createModem, listModems } from '@/lib/services/modem.service';

export const dynamic = 'force-dynamic';

export const GET = route(async (request) => {
  await requireStaffUser('products.modems.read');
  const filters = readQuery(request, modemFilterSchema);
  const result = await listModems({ ...filters, inStock: false }, {});
  return paginated(result.items, { page: result.page, limit: result.limit, total: result.total });
});

export const POST = route(async (request) => {
  await assertCsrf(request);
  const user = await requireStaffUser('products.modems.write');
  const input = await readJson(request, modemCreateSchema);
  const modem = await createModem(
    {
      brand: input.brand,
      model: input.model,
      title: input.title,
      price: input.price,
      stock: input.stock,
      description: input.description || undefined,
      imageUrl: input.imageUrl || undefined,
      warranty: input.warranty || undefined,
      operatorId: input.operatorId || undefined,
      specs: input.specs,
    },
    { userId: user.id, roleKey: user.roleKey, permissions: user.permissions, resellerId: null },
  );
  return ok({ id: modem.id, sku: modem.sku, title: modem.title });
});
