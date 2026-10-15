import { ok, route } from '@/lib/api';
import { getPhoneById, incrementPhoneViews } from '@/lib/services/phone.service';
import { notFound } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** جزئیات یک شماره */
export const GET = route(async (_request, ctx: { params: { id: string } }) => {
  const phone = await getPhoneById(ctx.params.id);
  if (!['AVAILABLE', 'RESERVED'].includes(phone.status)) throw notFound('این شماره در دسترس نیست');
  await incrementPhoneViews(phone.id);

  return ok({
    id: phone.id,
    msisdn: phone.msisdn,
    price: phone.price,
    operator: {
      name: phone.operator.name,
      code: phone.operator.code,
      color: phone.operator.color,
    },
    isRond: phone.isRond,
    isSequential: phone.isSequential,
    isRepeated: phone.isRepeated,
    isPalindrome: phone.isPalindrome,
    rondScore: phone.rondScore,
    description: phone.description,
    status: phone.status,
    ownerType: phone.ownerType,
  });
});
