import { ok, paginated, readJson, readQuery, route } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { phoneCreateSchema, phoneFilterSchema } from '@/lib/validation/product';
import { createPhone, listPhones } from '@/lib/services/phone.service';

export const dynamic = 'force-dynamic';

/** لیست کامل شماره‌ها (با امکان مشاهده‌ی فروخته‌شده) */
export const GET = route(async (request) => {
  await requireStaffUser('products.phones.read');
  const filters = readQuery(request, phoneFilterSchema);
  const result = await listPhones(filters, {});
  return paginated(result.items, { page: result.page, limit: result.limit, total: result.total });
});

/** ثبت شماره در سطح پلتفرم */
export const POST = route(async (request) => {
  await assertCsrf(request);
  const user = await requireStaffUser('products.phones.write');
  const input = await readJson(request, phoneCreateSchema);
  const phone = await createPhone(
    {
      msisdn: input.msisdn,
      price: input.price,
      description: input.description || undefined,
      operatorId: input.operatorId,
    },
    { userId: user.id, roleKey: user.roleKey, permissions: user.permissions, resellerId: null },
  );
  return ok({ id: phone.id, msisdn: phone.msisdn, price: phone.price });
});
