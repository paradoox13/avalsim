import { ok, readJson, route } from '@/lib/api';
import { assertSameOrigin } from '@/lib/csrf';
import { activationQuoteSchema } from '@/lib/validation/product';
import { quoteActivation } from '@/lib/services/activation.service';

export const dynamic = 'force-dynamic';

/** محاسبه‌ی خودکار قیمت کد فعال‌سازی بر اساس اپراتور و تعداد */
export const POST = route(async (request) => {
  assertSameOrigin(request);
  const input = await readJson(request, activationQuoteSchema);
  const quote = await quoteActivation(input.items);
  return ok({
    items: quote.items.map((item) => ({
      operatorId: item.operatorId,
      operatorName: item.operatorName,
      operatorColor: item.operatorColor,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      tier: item.tier,
    })),
    total: quote.total,
    quantity: quote.quantity,
  });
});
