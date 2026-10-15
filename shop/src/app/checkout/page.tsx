'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Money } from '@/components/site/money';
import { http } from '@/lib/client/api';
import { toPersianDigits, toEnglishDigits, onlyDigits } from '@/lib/utils/persian';
import { isValidIranianNationalId } from '@/lib/validation/common';
import { ShieldCheck, CreditCard } from 'lucide-react';
import type { CartView } from '@/lib/services/cart.service';

interface CheckoutResponse {
  orderNumber: string;
  trackingCode: string;
  total: string;
  redirectUrl: string;
}

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    nationalId: '',
    province: '',
    city: '',
    address: '',
    postalCode: '',
    note: '',
  });

  const load = useCallback(async () => {
    try {
      const result = await http.get<CartView>('/api/cart');
      setCart(result.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت سبد');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const requiresPhysical = cart?.totals.requiresPhysicalDelivery ?? false;
  const hasActivation = cart?.items.some((i) => i.productType === 'ACTIVATION_CODE') ?? false;

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.customerName.trim().length < 3) next.customerName = 'نام و نام خانوادگی را کامل وارد کنید';
    const phone = onlyDigits(form.customerPhone);
    if (!/^09\d{9}$/.test(phone)) next.customerPhone = 'شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)';
    if (form.customerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.customerEmail)) {
      next.customerEmail = 'ایمیل معتبر نیست';
    }
    if (requiresPhysical && form.address.trim().length < 10) {
      next.address = 'نشانی تحویل را کامل وارد کنید';
    }
    if (form.postalCode && !/^\d{10}$/.test(onlyDigits(form.postalCode))) {
      next.postalCode = 'کد پستی باید ۱۰ رقم باشد';
    }
    if (hasActivation && form.nationalId && !isValidIranianNationalId(form.nationalId)) {
      next.nationalId = 'کد ملی معتبر نیست';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) {
      toast.error('لطفاً خطاهای فرم را برطرف کنید');
      return;
    }
    setSubmitting(true);
    try {
      const result = await http.post<CheckoutResponse>('/api/checkout', {
        ...form,
        customerPhone: onlyDigits(form.customerPhone),
        postalCode: form.postalCode ? onlyDigits(form.postalCode) : '',
        nationalId: form.nationalId ? toEnglishDigits(form.nationalId) : '',
      });
      toast.success('در حال انتقال به درگاه پرداخت…');
      window.location.href = result.data.redirectUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در ثبت سفارش');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container grid gap-6 py-8 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!cart?.items.length) {
    return (
      <div className="container py-16 text-center">
        <p className="mb-4">سبد خرید شما خالی است.</p>
        <Button asChild>
          <Link href="/phones">مشاهده شماره‌ها</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-8">
      <h1 className="text-2xl font-bold">تکمیل خرید</h1>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <h2 className="font-semibold">اطلاعات خریدار</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName" required>نام و نام خانوادگی</Label>
                <Input
                  id="customerName"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  aria-invalid={Boolean(errors.customerName)}
                  required
                />
                {errors.customerName ? <p className="text-xs text-destructive">{errors.customerName}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPhone" required>شماره موبایل</Label>
                <Input
                  id="customerPhone"
                  dir="ltr"
                  inputMode="tel"
                  placeholder="09121234567"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  aria-invalid={Boolean(errors.customerPhone)}
                  required
                />
                {errors.customerPhone ? <p className="text-xs text-destructive">{errors.customerPhone}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerEmail">ایمیل (اختیاری)</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  dir="ltr"
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                />
                {errors.customerEmail ? <p className="text-xs text-destructive">{errors.customerEmail}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationalId">
                  کد ملی {hasActivation ? <span className="text-xs text-muted-foreground">(برای کد فعال‌سازی الزامی)</span> : '(اختیاری)'}
                </Label>
                <Input
                  id="nationalId"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.nationalId}
                  onChange={(e) => setForm({ ...form, nationalId: toEnglishDigits(e.target.value).replace(/\D/g, '') })}
                />
                {errors.nationalId ? <p className="text-xs text-destructive">{errors.nationalId}</p> : null}
              </div>
            </div>
          </Card>

          {requiresPhysical ? (
            <Card className="space-y-4 p-5">
              <h2 className="font-semibold">نشانی تحویل</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="province">استان</Label>
                  <Input
                    id="province"
                    value={form.province}
                    onChange={(e) => setForm({ ...form, province: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">شهر</Label>
                  <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">کد پستی</Label>
                  <Input
                    id="postalCode"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value.replace(/\D/g, '') })}
                  />
                  {errors.postalCode ? <p className="text-xs text-destructive">{errors.postalCode}</p> : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" required>نشانی کامل</Label>
                <Textarea
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="خیابان، کوچه، پلاک، واحد"
                  aria-invalid={Boolean(errors.address)}
                />
                {errors.address ? <p className="text-xs text-destructive">{errors.address}</p> : null}
              </div>
            </Card>
          ) : null}

          <Card className="space-y-3 p-5">
            <Label htmlFor="note">توضیحات سفارش (اختیاری)</Label>
            <Textarea
              id="note"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="هر توضیحی که لازم است بدانیم"
            />
          </Card>
        </div>

        <Card className="h-fit space-y-4 p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold">خلاصه‌ی سفارش</h2>
          <ul className="space-y-3 text-sm">
            {cart.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="line-clamp-2 text-muted-foreground">
                  {item.productType === 'PHONE_NUMBER'
                    ? toPersianDigits(item.title.replace(/(\d{4})(\d{3})(\d{4})/, '$1 - $2 - $3'))
                    : `${item.title} × ${toPersianDigits(item.quantity)}`}
                </span>
                <Money value={item.totalPrice} withUnit={false} className="whitespace-nowrap" />
              </li>
            ))}
          </ul>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">جمع اقلام</span>
            <Money value={cart.totals.subtotal} withUnit={false} />
          </div>
          {cart.totals.tax > 0n ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">مالیات</span>
              <Money value={cart.totals.tax} withUnit={false} />
            </div>
          ) : null}
          <Separator />
          <div className="flex justify-between text-base font-bold">
            <span>قابل پرداخت</span>
            <Money value={cart.totals.total} className="text-primary" />
          </div>

          <Button type="submit" className="w-full" size="lg" loading={submitting}>
            <CreditCard className="h-4 w-4" />
            پرداخت و ثبت سفارش
          </Button>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            پرداخت از طریق درگاه بانکی امن انجام می‌شود.
          </p>
        </Card>
      </form>
    </div>
  );
}
