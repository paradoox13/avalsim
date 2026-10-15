import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/site/money';
import { requireStaffUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { ORDER_STATUS_LABELS } from '@/lib/sms/templates';
import { toPersianDigits } from '@/lib/utils/persian';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { OrderActions } from '@/components/admin/order-actions';
import { ArrowRight, MessageSquare, User, MapPin, CreditCard } from 'lucide-react';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  PHONE_NUMBER: 'شماره سیم‌کارت',
  MODEM: 'مودم',
  ACTIVATION_CODE: 'کد فعال‌سازی',
};

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  await requireStaffUser('orders.read');

  const order = await prisma.order
    .findUnique({
      where: { id: params.id },
      include: {
        items: { include: { phoneNumber: true, modem: true, operator: true } },
        payments: true,
        smsLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        user: { select: { id: true, fullName: true, phone: true, email: true } },
      },
    })
    .catch(() => null);

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="بازگشت">
            <Link href="/admin/orders">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-lg font-bold" dir="ltr">{order.orderNumber}</h2>
            <p className="text-xs text-muted-foreground">
              کد رهگیری: <span dir="ltr">{toPersianDigits(order.trackingCode)}</span>
            </p>
          </div>
        </div>
        <Badge variant={order.status === 'DELIVERED' ? 'success' : order.status === 'CANCELED' ? 'destructive' : 'secondary'}>
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-5 lg:col-span-2">
          <h3 className="font-semibold">اقلام سفارش</h3>
          <ul className="divide-y rounded-lg border">
            {order.items.map((item) => (
              <li key={item.id} className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{item.title}</span>
                  <Money value={item.totalPrice} />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>نوع: {TYPE_LABELS[item.productType] ?? item.productType}</span>
                  <span>تعداد: {toPersianDigits(item.quantity)}</span>
                  {item.operator ? <span>اپراتور: {item.operator.name}</span> : null}
                  {item.ownerType === 'RESELLER' ? (
                    <span>
                      نماینده — کمیسیون: <Money value={item.commissionAmount} withUnit={false} /> (
                      {toPersianDigits(item.commissionRate / 100)}٪)
                    </span>
                  ) : (
                    <span>مالکیت: پلتفرم</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between rounded-lg border p-3">
              <dt className="text-muted-foreground">جمع اقلام</dt>
              <dd><Money value={order.subtotal} withUnit={false} /></dd>
            </div>
            <div className="flex justify-between rounded-lg border p-3">
              <dt className="text-muted-foreground">مالیات</dt>
              <dd><Money value={order.tax} withUnit={false} /></dd>
            </div>
            <div className="flex justify-between rounded-lg border p-3">
              <dt className="text-muted-foreground">کمیسیون نمایندگان</dt>
              <dd><Money value={order.resellerCommission} withUnit={false} /></dd>
            </div>
            <div className="flex justify-between rounded-lg border bg-muted/40 p-3 font-bold">
              <dt>مبلغ نهایی</dt>
              <dd><Money value={order.total} /></dd>
            </div>
          </dl>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3 p-5 text-sm">
            <h3 className="flex items-center gap-2 font-semibold">
              <User className="h-4 w-4 text-primary" />
              خریدار
            </h3>
            <p>{order.customerName}</p>
            <p dir="ltr" className="text-muted-foreground">{toPersianDigits(order.customerPhone)}</p>
            {order.customerEmail ? <p dir="ltr" className="text-muted-foreground">{order.customerEmail}</p> : null}
            {order.nationalId ? (
              <p className="text-muted-foreground">کد ملی: <span dir="ltr">{toPersianDigits(order.nationalId)}</span></p>
            ) : null}
            {order.userId ? (
              <Badge variant="outline">کاربر ثبت‌نام‌شده</Badge>
            ) : (
              <Badge variant="secondary">خرید مهمان</Badge>
            )}
          </Card>

          {order.address ? (
            <Card className="space-y-2 p-5 text-sm">
              <h3 className="flex items-center gap-2 font-semibold">
                <MapPin className="h-4 w-4 text-primary" />
                نشانی تحویل
              </h3>
              <p className="leading-6 text-muted-foreground">{order.address}</p>
              {order.postalCode ? (
                <p className="text-muted-foreground">کد پستی: <span dir="ltr">{toPersianDigits(order.postalCode)}</span></p>
              ) : null}
            </Card>
          ) : null}

          <Card className="space-y-3 p-5 text-sm">
            <h3 className="flex items-center gap-2 font-semibold">
              <CreditCard className="h-4 w-4 text-primary" />
              پرداخت‌ها
            </h3>
            {order.payments.length ? (
              <ul className="space-y-2">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="rounded-lg border p-3 text-xs">
                    <p>درگاه: {payment.gateway}</p>
                    <p>وضعیت: {payment.status}</p>
                    {payment.refId ? <p dir="ltr">پیگیری بانکی: {toPersianDigits(payment.refId)}</p> : null}
                    <p className="text-muted-foreground">{formatJalaliDateTime(payment.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">پرداختی ثبت نشده است.</p>
            )}
          </Card>

          <OrderActions orderId={order.id} currentStatus={order.status} />
        </div>
      </div>

      {order.smsLogs.length ? (
        <Card className="space-y-3 p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <MessageSquare className="h-4 w-4 text-primary" />
            پیامک‌های این سفارش
          </h3>
          <ul className="divide-y rounded-lg border text-xs">
            {order.smsLogs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="max-w-xl">{log.message}</span>
                <span className="text-muted-foreground">
                  {log.mobile} — {log.status} — {formatJalaliDateTime(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
