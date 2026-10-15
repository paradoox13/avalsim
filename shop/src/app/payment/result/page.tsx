import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Package, Truck } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { toPersianDigits } from '@/lib/utils/persian';
import { formatToman } from '@/lib/utils/money';
import { ORDER_STATUS_LABELS } from '@/lib/sms/templates';

export const metadata: Metadata = { title: 'نتیجه پرداخت', robots: { index: false } };
export const dynamic = 'force-dynamic';

const FAILURE_REASONS: Record<string, string> = {
  canceled: 'پرداخت توسط شما لغو شد یا ناموفق بود.',
  verify_failed: 'تأیید تراکنش توسط درگاه انجام نشد.',
  missing_authority: 'اطلاعات بازگشتی از درگاه کامل نبود.',
  payment_not_found: 'تراکنش متناظر با این پرداخت پیدا نشد.',
  inactive_gateway: 'این درگاه در حال حاضر فعال نیست.',
  gateway: 'درگاه پرداخت نامعتبر است.',
  error: 'خطای غیرمنتظره در فرآیند پرداخت رخ داد.',
};

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: { status?: string; order?: string; tracking?: string; reason?: string };
}) {
  const success = searchParams.status === 'success';

  const order = searchParams.order
    ? await prisma.order
        .findUnique({
          where: { orderNumber: searchParams.order },
          include: { items: true, payments: true },
        })
        .catch(() => null)
    : null;

  return (
    <div className="container max-w-2xl space-y-6 py-14">
      <Card className="space-y-6 p-8 text-center">
        {success ? (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-[hsl(var(--success))]" aria-hidden />
            <h1 className="text-2xl font-bold">پرداخت با موفقیت انجام شد</h1>
            <p className="text-sm text-muted-foreground">
              سفارش شما ثبت شد. اطلاعات تکمیلی از طریق پیامک برای شما ارسال می‌شود.
            </p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-16 w-16 text-destructive" aria-hidden />
            <h1 className="text-2xl font-bold">پرداخت انجام نشد</h1>
            <p className="text-sm text-muted-foreground">
              {FAILURE_REASONS[searchParams.reason ?? ''] ?? 'پرداخت شما تکمیل نشد.'}
            </p>
          </>
        )}

        {order ? (
          <dl className="space-y-3 rounded-xl border p-5 text-right text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">شماره سفارش</dt>
              <dd className="font-medium" dir="ltr">{order.orderNumber}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">کد رهگیری</dt>
              <dd className="font-bold tracking-widest" dir="ltr">
                {toPersianDigits(order.trackingCode)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">مبلغ</dt>
              <dd className="font-medium">{formatToman(order.total)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">وضعیت</dt>
              <dd>
                <Badge variant={success ? 'success' : 'destructive'}>
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </Badge>
              </dd>
            </div>
            {order.payments.some((p) => p.refId) ? (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">شماره پیگیری بانکی</dt>
                <dd dir="ltr">
                  {toPersianDigits(order.payments.find((p) => p.refId)?.refId ?? '-')}
                </dd>
              </div>
            ) : null}
            <div className="border-t pt-3">
              <dt className="mb-2 text-muted-foreground">اقلام سفارش</dt>
              <dd>
                <ul className="space-y-1">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between">
                      <span>{item.title}</span>
                      <span className="text-muted-foreground">× {toPersianDigits(item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        ) : null}

        {success && order?.status === 'AWAITING_PHYSICAL_DELIVERY' ? (
          <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-accent/40 p-4 text-right text-sm">
            <Truck className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
            <p>
              سفارش شما در انتظار ارسال فیزیکی است. کارشناسان ما پس از آماده‌سازی، مرسوله را ارسال
              می‌کنند و کد رهگیری پستی برای شما پیامک می‌شود.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/phones">
              <Package className="h-4 w-4" />
              ادامه‌ی خرید
            </Link>
          </Button>
          {order?.trackingCode ? (
            <Button variant="outline" asChild>
              <Link href={`/track?code=${order.trackingCode}`}>پیگیری سفارش</Link>
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
