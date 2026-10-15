'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ShoppingCart, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatToman } from '@/lib/utils/money';
import { toPersianDigits } from '@/lib/utils/persian';
import { computeTierTotal, formatTierRange, pickTier } from '@/lib/utils/pricing';
import { http } from '@/lib/client/api';
import type { CartView } from '@/lib/services/cart.service';

export interface ActivationOperator {
  id: string;
  name: string;
  code: string;
  color: string;
  tiers: Array<{ minQty: number; maxQty: number | null; unitPrice: string | number | bigint }>;
}

/**
 * ماشین‌حساب کد فعال‌سازی:
 * مشتری فقط اپراتور و تعداد را انتخاب می‌کند و قیمت به‌صورت خودکار محاسبه می‌شود.
 */
export function ActivationCalculator({
  operators,
  maxQty = 50,
  onCartChange,
}: {
  operators: ActivationOperator[];
  maxQty?: number;
  onCartChange?: (cart: CartView) => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const normalized = useMemo(
    () =>
      operators.map((op) => ({
        ...op,
        tiers: op.tiers.map((t) => ({
          minQty: t.minQty,
          maxQty: t.maxQty,
          unitPrice: BigInt(t.unitPrice),
        })),
      })),
    [operators],
  );

  const selected = normalized.filter((op) => (quantities[op.id] ?? 0) > 0);
  const total = selected.reduce((sum, op) => sum + computeTierTotal(op.tiers, quantities[op.id] ?? 0), 0n);
  const totalQty = selected.reduce((sum, op) => sum + (quantities[op.id] ?? 0), 0);

  async function addToCart() {
    if (!selected.length) {
      toast.error('ابتدا اپراتور و تعداد را انتخاب کنید');
      return;
    }
    setLoading(true);
    try {
      let lastCart: CartView | null = null;
      for (const op of selected) {
        const result = await http.post<CartView>('/api/cart/items', {
          productType: 'ACTIVATION_CODE',
          operatorId: op.id,
          quantity: quantities[op.id],
        });
        lastCart = result.data;
      }
      toast.success('کدهای فعال‌سازی به سبد اضافه شد');
      if (lastCart) onCartChange?.(lastCart);
      setQuantities({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در افزودن به سبد');
    } finally {
      setLoading(false);
    }
  }

  if (!normalized.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        قیمت کدهای فعال‌سازی هنوز ثبت نشده است. لطفاً بعداً مراجعه کنید.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {normalized.map((op) => {
          const qty = quantities[op.id] ?? 0;
          const tier = pickTier(op.tiers, qty > 0 ? qty : 1);
          const lineTotal = qty > 0 ? computeTierTotal(op.tiers, qty) : 0n;
          return (
            <Card key={op.id} className="overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: op.color }} aria-hidden />
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{op.name}</h3>
                  {tier ? (
                    <Badge variant="secondary">{formatToman(tier.unitPrice, true)} / عدد</Badge>
                  ) : null}
                </div>

                <ul className="space-y-1 text-xs text-muted-foreground">
                  {op.tiers.slice(0, 3).map((t) => (
                    <li key={`${t.minQty}-${t.maxQty ?? 'inf'}`} className="flex justify-between">
                      <span>{formatTierRange(t)}</span>
                      <span dir="rtl">{formatToman(t.unitPrice, false)} تومان</span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={maxQty}
                    dir="ltr"
                    className="h-9"
                    placeholder="تعداد"
                    value={qty || ''}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(maxQty, Number(e.target.value.replace(/\D/g, '')) || 0));
                      setQuantities((prev) => ({ ...prev, [op.id]: value }));
                    }}
                    aria-label={`تعداد کد ${op.name}`}
                  />
                  {qty > 0 ? (
                    <span className="whitespace-nowrap text-xs font-medium" dir="rtl">
                      {formatToman(lineTotal, false)} تومان
                    </span>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row">
        <div className="text-sm">
          <p className="flex items-center gap-1 text-muted-foreground">
            <Info className="h-4 w-4" />
            پس از پرداخت، کد فعال‌سازی برای شما ارسال می‌شود و ادمین از سفارش مطلع می‌گردد.
          </p>
          {totalQty > 0 ? (
            <p className="mt-1 font-semibold" dir="rtl">
              {toPersianDigits(totalQty)} کد — مجموع: {formatToman(total)}
            </p>
          ) : null}
        </div>
        <Button onClick={addToCart} loading={loading} size="lg">
          <ShoppingCart className="h-4 w-4" />
          افزودن به سبد خرید
        </Button>
      </Card>
    </div>
  );
}
