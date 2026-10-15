'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Money } from '@/components/site/money';
import { http } from '@/lib/client/api';
import { toPersianDigits } from '@/lib/utils/persian';
import { Trash2, Minus, Plus, ShoppingBag, AlertTriangle, ArrowLeft } from 'lucide-react';
import type { CartView } from '@/lib/services/cart.service';

export default function CartPage() {
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await http.get<CartView>('/api/cart');
      setCart(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت سبد خرید');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function changeQuantity(id: string, quantity: number) {
    setBusyId(id);
    try {
      const result = await http.patch<CartView>(`/api/cart/items/${id}`, { quantity });
      setCart(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در تغییر تعداد');
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(id: string) {
    setBusyId(id);
    try {
      const result = await http.delete<CartView>(`/api/cart/items/${id}`);
      setCart(result.data);
      toast.success('آیتم حذف شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در حذف آیتم');
    } finally {
      setBusyId(null);
    }
  }

  async function clearCart() {
    try {
      await http.post('/api/cart/clear');
      await load();
      toast.success('سبد خرید خالی شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در خالی‌کردن سبد');
    }
  }

  if (loading) {
    return (
      <div className="container space-y-4 py-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const items = cart?.items ?? [];
  const hasIssues = items.some((item) => !item.available);

  return (
    <div className="container space-y-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShoppingBag className="h-6 w-6" />
          سبد خرید
        </h1>
        {items.length ? (
          <Button variant="ghost" size="sm" onClick={clearCart}>
            <Trash2 className="h-4 w-4" />
            خالی کردن سبد
          </Button>
        ) : null}
      </header>

      {!items.length ? (
        <Card className="flex flex-col items-center gap-4 p-12 text-center">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" aria-hidden />
          <p className="font-medium">سبد خرید شما خالی است</p>
          <p className="text-sm text-muted-foreground">برای شروع، شماره یا مودم مورد نظر خود را انتخاب کنید.</p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/phones">مشاهده شماره‌ها</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/modems">مشاهده مودم‌ها</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {hasIssues ? (
              <Card className="flex items-start gap-3 border-destructive/40 bg-destructive/5 p-4 text-sm">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" aria-hidden />
                <p>
                  برخی اقلام سبد خرید دیگر موجود نیستند و در محاسبه‌ی مبلغ لحاظ نشده‌اند. لطفاً آن‌ها را
                  حذف کنید یا دوباره انتخاب کنید.
                </p>
              </Card>
            ) : null}

            {items.map((item) => (
              <Card
                key={item.id}
                className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                  item.available ? '' : 'opacity-70'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.available ? 'secondary' : 'destructive'}>
                      {item.productType === 'PHONE_NUMBER'
                        ? 'شماره سیم‌کارت'
                        : item.productType === 'MODEM'
                          ? 'مودم'
                          : 'کد فعال‌سازی'}
                    </Badge>
                    {item.issue ? <span className="text-xs text-destructive">{item.issue}</span> : null}
                  </div>
                  <p className="font-medium" dir={item.productType === 'PHONE_NUMBER' ? 'ltr' : 'rtl'}>
                    {item.productType === 'PHONE_NUMBER'
                      ? toPersianDigits(item.title.replace(/(\d{4})(\d{3})(\d{4})/, '$1 - $2 - $3'))
                      : item.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    قیمت واحد: <Money value={item.unitPrice} />
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {item.productType === 'PHONE_NUMBER' ? (
                    <span className="text-sm text-muted-foreground">تعداد: ۱</span>
                  ) : (
                    <div className="flex items-center gap-1 rounded-lg border p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={busyId === item.id || item.quantity <= 1}
                        onClick={() => changeQuantity(item.id, item.quantity - 1)}
                        aria-label="کاهش تعداد"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-8 text-center text-sm">{toPersianDigits(item.quantity)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={busyId === item.id}
                        onClick={() => changeQuantity(item.id, item.quantity + 1)}
                        aria-label="افزایش تعداد"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  <Money value={item.totalPrice} className="min-w-[110px] text-left font-semibold" />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    disabled={busyId === item.id}
                    onClick={() => removeItem(item.id)}
                    aria-label="حذف از سبد"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="h-fit space-y-4 p-5 lg:sticky lg:top-24">
            <h2 className="font-semibold">خلاصه‌ی سفارش</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">جمع اقلام</dt>
                <dd><Money value={cart!.totals.subtotal} withUnit={false} /></dd>
              </div>
              {cart!.totals.tax > 0n ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">مالیات بر ارزش افزوده</dt>
                  <dd><Money value={cart!.totals.tax} withUnit={false} /></dd>
                </div>
              ) : null}
              {cart!.totals.discount > 0n ? (
                <div className="flex justify-between text-[hsl(var(--success))]">
                  <dt>تخفیف</dt>
                  <dd><Money value={cart!.totals.discount} withUnit={false} /></dd>
                </div>
              ) : null}
            </dl>
            <Separator />
            <div className="flex items-center justify-between text-base font-bold">
              <span>مبلغ قابل پرداخت</span>
              <Money value={cart!.totals.total} className="text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              تعداد اقلام: {toPersianDigits(cart!.totals.itemCount)}
            </p>
            <Button className="w-full" size="lg" asChild disabled={hasIssues}>
              <Link href="/checkout">
                ادامه‌ی فرآیند خرید
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" className="w-full" asChild>
              <Link href="/phones">ادامه‌ی خرید</Link>
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
