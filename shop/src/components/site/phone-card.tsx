'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ShoppingCart, Sparkles, Eye } from 'lucide-react';
import { Money } from './money';
import { toPersianDigits } from '@/lib/utils/persian';
import { describeAnalysis, analyzeNumber } from '@/lib/utils/pattern';
import { http } from '@/lib/client/api';
import type { CartView } from '@/lib/services/cart.service';

export interface PhoneCardData {
  id: string;
  msisdn: string;
  price: string | number | bigint;
  operator: { name: string; code: string; color: string };
  isRond: boolean;
  isSequential: boolean;
  isRepeated: boolean;
  isPalindrome: boolean;
  rondScore: number;
  description: string | null;
}

/** کارت نمایش شماره با نشانگر ویژگی‌ها و افزودن به سبد */
export function PhoneCard({
  phone,
  onAdded,
}: {
  phone: PhoneCardData;
  onAdded?: (cart: CartView) => void;
}) {
  const [loading, setLoading] = useState(false);
  const analysis = analyzeNumber(phone.msisdn);

  // نمایش شماره: ۰۹۱۲ - ۱۲۳ - ۴۵۶۷
  const formatted = `${phone.msisdn.slice(0, 4)} - ${phone.msisdn.slice(4, 7)} - ${phone.msisdn.slice(7)}`;

  async function addToCart() {
    setLoading(true);
    try {
      const result = await http.post<CartView>('/api/cart/items', {
        productType: 'PHONE_NUMBER',
        phoneNumberId: phone.id,
      });
      toast.success('شماره به سبد خرید اضافه شد');
      onAdded?.(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در افزودن به سبد');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: phone.operator.color }} aria-hidden />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: phone.operator.color }} aria-hidden />
            {phone.operator.name}
          </Badge>
          {phone.isRond ? (
            <Badge variant="success" className="gap-1">
              <Sparkles className="h-3 w-3" />
              رند
            </Badge>
          ) : null}
        </div>

        <p className="text-center text-xl font-bold tracking-wide fa-num" dir="ltr">
          {toPersianDigits(formatted)}
        </p>

        <div className="flex flex-wrap justify-center gap-1">
          {analysis.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>

        {phone.description ? (
          <p className="line-clamp-1 text-center text-xs text-muted-foreground">{phone.description}</p>
        ) : null}

        <div className="mt-1 flex items-center justify-between gap-2">
          <Money value={phone.price} className="text-base font-bold text-primary" />
          <Button size="sm" onClick={addToCart} loading={loading} aria-label="افزودن به سبد خرید">
            <ShoppingCart className="h-4 w-4" />
            خرید
          </Button>
        </div>
      </div>
    </Card>
  );
}

export { describeAnalysis, Eye };
