import { ok, route } from '@/lib/api';
import { listOperatorsWithPrices } from '@/lib/services/operator.service';

export const dynamic = 'force-dynamic';

/** لیست اپراتورها — برای فیلترها و بخش کد فعال‌سازی */
export const GET = route(async () => {
  const operators = await listOperatorsWithPrices();
  return ok(
    operators.map((op) => ({
      id: op.id,
      code: op.code,
      name: op.name,
      slug: op.slug,
      color: op.color,
      tiers: op.tiers.map((t) => ({
        id: t.id,
        minQty: t.minQty,
        maxQty: t.maxQty,
        unitPrice: t.unitPrice,
        description: t.description,
      })),
    })),
  );
});
