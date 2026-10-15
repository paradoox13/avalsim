'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ShieldCheck, Package } from 'lucide-react';
import { Money } from './money';
import { toPersianDigits } from '@/lib/utils/persian';
import { http } from '@/lib/client/api';
import type { CartView } from '@/lib/services/cart.service';

export interface ModemCardData {
  id: string;
  title: string;
  brand: string;
  model: string;
  price: string | number | bigint;
  stock: number;
  imageUrl: string | null;
  warranty: string | null;
}

/** کارت مودم با دکمه‌ی افزودن به سبد */
export function ModemCard({
  modem,
  onCartChange,
}: {
  modem: ModemCardData;
  onCartChange?: (cart: CartView) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function addToCart() {
    setLoading(true);
    try {
      const result = await http.post<CartView>('/api/cart/items', {
        productType: 'MODEM',
        modemId: modem.id,
        quantity: 1,
      });
      toast.success('مودم به سبد خرید اضافه شد');
      onCartChange?.(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در افزودن به سبد');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <Link href={`/modems/${modem.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {modem.imageUrl ? (
            <Image
              src={modem.imageUrl}
              alt={modem.title}
              fill
              sizes="(max-width: 768px) 100vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Package className="h-10 w-10" aria-hidden />
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline">{modem.brand}</Badge>
          {modem.stock > 0 ? (
            <Badge variant="success">
              موجود ({toPersianDigits(modem.stock)})
            </Badge>
          ) : (
            <Badge variant="destructive">ناموجود</Badge>
          )}
        </div>

        <Link href={`/modems/${modem.id}`} className="line-clamp-2 text-sm font-medium hover:text-primary">
          {modem.title}
        </Link>

        {modem.warranty ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            {modem.warranty}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <Money value={modem.price} className="text-base font-bold text-primary" />
          <Button size="sm" onClick={addToCart} loading={loading} disabled={modem.stock <= 0}>
            <ShoppingCart className="h-4 w-4" />
            افزودن
          </Button>
        </div>
      </div>
    </Card>
  );
}
