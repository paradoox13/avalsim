import { ok, paginated, readJson, readQuery, route } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { requireApprovedReseller } from '@/lib/guards';
import { phoneCreateSchema, phoneFilterSchema } from '@/lib/validation/product';
import { createPhone, listPhones } from '@/lib/services/phone.service';

export const dynamic = 'force-dynamic';

/** لیست شماره‌های نماینده */
export const GET = route(async (request) => {
  const { resellerId } = await requireApprovedReseller();
  const filters = readQuery(request, phoneFilterSchema);
  const result = await listPhones(
    { ...filters, onlyAvailable: false, includeSold: true },
    { extraWhere: { resellerId } },
  );
  return paginated(result.items, { page: result.page, limit: result.limit, total: result.total });
});

/** ثبت دستی شماره‌ی جدید */
export const POST = route(async (request) => {
  await assertCsrf(request);
  const { user, resellerId } = await requireApprovedReseller();
  const input = await readJson(request, phoneCreateSchema);

  const phone = await createPhone(
    {
      msisdn: input.msisdn,
      price: input.price,
      description: input.description || undefined,
      operatorId: input.operatorId,
    },
    { userId: user.id, roleKey: user.roleKey, permissions: user.permissions, resellerId },
  );

  return ok({ id: phone.id, msisdn: phone.msisdn, price: phone.price, status: phone.status });
});
