'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { http } from '@/lib/client/api';
import { toPersianDigits, toEnglishDigits } from '@/lib/utils/persian';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { formatToman } from '@/lib/utils/money';
import { PackageSearch, Search } from 'lucide-react';
import { Suspense } from 'react';

interface TrackResult {
  orderNumber: string;
  trackingCode: string;
  status: string;
  statusLabel: string;
  total: string;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  shippingCarrier: string | null;
  shippingTracking: string | null;
  items: Array<{ title: string; quantity: number; unitPrice: string }>;
}

function TrackForm() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        setError('کد رهگیری یا شماره سفارش را وارد کنید');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const isOrderNumber = value.toUpperCase().startsWith('SH-');
        const params = new URLSearchParams(
          isOrderNumber ? { orderNumber: value } : { code: value },
        );
        if (phone) params.set('phone', phone);
        const response = await http.get<TrackResult>(`/api/orders/track?${params.toString()}`);
        setResult(response.data);
      } catch (err) {
        setResult(null);
        setError(err instanceof Error ? err.message : 'سفارش یافت نشد');
      } finally {
        setLoading(false);
      }
    },
    [phone],
  );

  useEffect(() => {
    const initial = searchParams.get('code');
    if (initial) search(initial);
  }, [searchParams, search]);

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            search(code);
          }}
          className="grid gap-4 sm:grid-cols-[1fr_200px_auto]"
        >
          <div className="space-y-2">
            <Label htmlFor="code">کد رهگیری یا شماره سفارش</Label>
            <Input
              id="code"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(toEnglishDigits(e.target.value).toUpperCase())}
              placeholder="مثال: AB12CD34EF یا SH-14030812-000123"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">۴ رقم آخر موبایل (اختیاری)</Label>
            <Input
              id="phone"
              dir="ltr"
              maxLength={4}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" loading={loading} className="w-full">
              <Search className="h-4 w-4" />
              پیگیری
            </Button>
          </div>
        </form>
      </Card>

      {error ? (
        <Card className="flex items-center gap-3 border-destructive/40 bg-destructive/5 p-5 text-sm">
          <PackageSearch className="h-5 w-5 text-destructive" aria-hidden />
          {error}
        </Card>
      ) : null}

      {result ? (
        <Card className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">شماره سفارش</p>
              <p className="font-medium" dir="ltr">{result.orderNumber}</p>
            </div>
            <Badge variant="default">{result.statusLabel}</Badge>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex justify-between rounded-lg border p-3">
              <dt className="text-muted-foreground">مبلغ</dt>
              <dd>{formatToman(BigInt(result.total))}</dd>
            </div>
            <div className="flex justify-between rounded-lg border p-3">
              <dt className="text-muted-foreground">تاریخ ثبت</dt>
              <dd>{formatJalaliDateTime(result.createdAt)}</dd>
            </div>
            {result.paidAt ? (
              <div className="flex justify-between rounded-lg border p-3">
                <dt className="text-muted-foreground">تاریخ پرداخت</dt>
                <dd>{formatJalaliDateTime(result.paidAt)}</dd>
              </div>
            ) : null}
            {result.shippedAt ? (
              <div className="flex justify-between rounded-lg border p-3">
                <dt className="text-muted-foreground">تاریخ ارسال</dt>
                <dd>{formatJalaliDateTime(result.shippedAt)}</dd>
              </div>
            ) : null}
            {result.shippingCarrier ? (
              <div className="flex justify-between rounded-lg border p-3">
                <dt className="text-muted-foreground">شرکت حمل</dt>
                <dd>{result.shippingCarrier}</dd>
              </div>
            ) : null}
            {result.shippingTracking ? (
              <div className="flex justify-between rounded-lg border p-3">
                <dt className="text-muted-foreground">کد رهگیری پستی</dt>
                <dd dir="ltr">{toPersianDigits(result.shippingTracking)}</dd>
              </div>
            ) : null}
          </dl>

          <div>
            <h2 className="mb-2 text-sm font-semibold">اقلام سفارش</h2>
            <ul className="divide-y rounded-lg border text-sm">
              {result.items.map((item, index) => (
                <li key={index} className="flex justify-between p-3">
                  <span>{item.title}</span>
                  <span className="text-muted-foreground">× {toPersianDigits(item.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export default function TrackPage() {
  return (
    <div className="container max-w-3xl space-y-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">پیگیری سفارش</h1>
        <p className="text-sm text-muted-foreground">
          کد رهگیری سفارش خود را وارد کنید تا وضعیت پرداخت و ارسال را ببینید.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <TrackForm />
      </Suspense>
    </div>
  );
}
