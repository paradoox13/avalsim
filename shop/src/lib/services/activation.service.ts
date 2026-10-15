import { prisma } from '../prisma';
import { badRequest, notFound } from '../errors';
import { writeAudit } from '../audit';
import { invalidateOperatorCache, listOperatorsWithPrices } from './operator.service';
import { mulToman, sumToman, type Toman } from '../utils/money';
import type { Actor } from './phone.service';

import { pickTier, type ActivationTier } from '../utils/pricing';

export { pickTier };
export type { ActivationTier };

export interface ActivationQuoteItem {
  operatorId: string;
  operatorName: string;
  operatorColor: string;
  quantity: number;
  unitPrice: bigint;
  totalPrice: bigint;
  tier: ActivationTier;
}

export interface ActivationQuote {
  items: ActivationQuoteItem[];
  total: bigint;
  quantity: number;
}

/** محاسبه‌ی خودکار قیمت کد فعال‌سازی بر اساس اپراتور و تعداد */
export async function quoteActivation(
  items: Array<{ operatorId: string; quantity: number }>,
): Promise<ActivationQuote> {
  const operators = await listOperatorsWithPrices();
  const map = new Map(operators.map((o) => [o.id, o]));
  const result: ActivationQuoteItem[] = [];
  const problems: string[] = [];

  for (const item of items) {
    const operator = map.get(item.operatorId);
    if (!operator) {
      problems.push('اپراتور انتخابی یافت نشد');
      continue;
    }
    if (item.quantity < 1) {
      problems.push(`تعداد برای ${operator.name} نامعتبر است`);
      continue;
    }
    const tier = pickTier(operator.tiers, item.quantity);
    if (!tier) {
      problems.push(`قیمتی برای ${operator.name} ثبت نشده است`);
      continue;
    }
    result.push({
      operatorId: operator.id,
      operatorName: operator.name,
      operatorColor: operator.color,
      quantity: item.quantity,
      unitPrice: tier.unitPrice,
      totalPrice: mulToman(tier.unitPrice, item.quantity),
      tier,
    });
  }

  if (problems.length) throw badRequest(problems.join('، '));
  if (!result.length) throw badRequest('سبد خرید کد فعال‌سازی خالی است');

  const total = sumToman(result.map((i) => i.totalPrice));
  return { items: result, total, quantity: result.reduce((sum, i) => sum + i.quantity, 0) };
}

export async function listActivationCatalog() {
  return listOperatorsWithPrices();
}

export interface ActivationPriceInput {
  operatorId: string;
  unitPrice: bigint;
  minQty: number;
  maxQty?: number | null;
  isActive?: boolean;
  description?: string;
}

/** ثبت یا ویرایش پله‌ی قیمت کد فعال‌سازی (پنل ادمین) */
export async function upsertActivationPrice(input: ActivationPriceInput, actor: Actor) {
  const operator = await prisma.operator.findUnique({ where: { id: input.operatorId } });
  if (!operator) throw notFound('اپراتور یافت نشد');
  if (input.maxQty !== null && input.maxQty !== undefined && input.maxQty < input.minQty) {
    throw badRequest('بازه‌ی تعداد نامعتبر است (حداکثر کمتر از حداقل است)');
  }

  const price = await prisma.activationCodePrice.upsert({
    where: { operatorId_minQty: { operatorId: input.operatorId, minQty: input.minQty } },
    create: {
      operatorId: input.operatorId,
      unitPrice: input.unitPrice,
      minQty: input.minQty,
      maxQty: input.maxQty ?? null,
      isActive: input.isActive ?? true,
      description: input.description ?? null,
    },
    update: {
      unitPrice: input.unitPrice,
      maxQty: input.maxQty ?? null,
      isActive: input.isActive ?? true,
      description: input.description ?? null,
    },
  });

  await invalidateOperatorCache();
  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'UPSERT',
    entity: 'ActivationCodePrice',
    entityId: price.id,
    after: { operatorId: input.operatorId, unitPrice: input.unitPrice.toString(), minQty: input.minQty },
  });
  return price;
}

export async function deleteActivationPrice(id: string, actor: Actor) {
  const price = await prisma.activationCodePrice.findUnique({ where: { id } });
  if (!price) throw notFound('قیمت یافت نشد');
  await prisma.activationCodePrice.delete({ where: { id } });
  await invalidateOperatorCache();
  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'DELETE',
    entity: 'ActivationCodePrice',
    entityId: id,
    before: { unitPrice: price.unitPrice.toString(), minQty: price.minQty },
  });
}
