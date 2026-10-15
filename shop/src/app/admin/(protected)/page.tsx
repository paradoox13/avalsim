import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/site/money';
import { requireStaffUser } from '@/lib/guards';
import { getDashboardStats } from '@/lib/services/report.service';
import { ORDER_STATUS_LABELS } from '@/lib/sms/templates';
import { toPersianDigits } from '@/lib/utils/persian';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { ShoppingCart, Users, Smartphone, Wifi, MessageSquare, Wallet, TrendingUp, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  await requireStaffUser('dashboard.view');
  const stats = await getDashboardStats();

  const maxSeries = Math.max(1, ...stats.series.map((s) => s.orders));

  const cards = [
    {
      title: 'فروش کل',
      value: <Money value={stats.sales.total} />,
      hint: `${toPersianDigits(stats.sales.count)} سفارش پرداخت‌شده`,
      icon: TrendingUp,
    },
    {
      title: 'فروش امروز',
      value: <Money value={stats.sales.today} />,
      hint: `این ماه: ${new Intl.NumberFormat('fa-IR').format(Number(stats.sales.month))} تومان`,
      icon: Wallet,
    },
    {
      title: 'سفارش‌ها',
      value: toPersianDigits(Object.values(stats.orders).reduce((a, b) => a + b, 0)),
      hint: `در انتظار پرداخت: ${toPersianDigits(stats.orders.PENDING_PAYMENT ?? 0)}`,
      icon: ShoppingCart,
    },
    {
      title: 'کاربران',
      value: toPersianDigits(stats.customers),
      hint: `نمایندگان فعال: ${toPersianDigits(stats.resellers.approved)}`,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{card.title}</p>
              <card.icon className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <p className="text-lg font-bold">{card.value}</p>
            <p className="text-[11px] text-muted-foreground">{card.hint}</p>
          </Card>
        ))}
      </div>

      {/* نمودار فروش ۱۴ روز اخیر */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">فروش ۱۴ روز گذشته</h2>
          <Badge variant="outline">تعداد سفارش پرداخت‌شده</Badge>
        </div>
        <div className="flex h-40 items-end justify-between gap-1" role="img" aria-label="نمودار فروش روزانه">
          {stats.series.map((point) => (
            <div key={point.day} className="group flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                {toPersianDigits(point.orders)}
              </span>
              <div
                className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
                style={{ height: `${Math.max(4, (point.orders / maxSeries) * 100)}%` }}
                title={`${point.day}: ${point.orders} سفارش`}
              />
              <span className="text-[9px] text-muted-foreground">
                {point.day.slice(8, 10)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Smartphone className="h-4 w-4 text-primary" />
            موجودی شماره‌ها
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">موجود</dt>
              <dd className="font-medium text-[hsl(var(--success))]">{toPersianDigits(stats.phones.available)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">رزرو موقت</dt>
              <dd className="font-medium text-[hsl(var(--warning))]">{toPersianDigits(stats.phones.reserved)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">فروخته‌شده</dt>
              <dd className="font-medium">{toPersianDigits(stats.phones.sold)}</dd>
            </div>
          </dl>
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href="/admin/phones">مدیریت شماره‌ها</Link>
          </Button>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Wifi className="h-4 w-4 text-primary" />
            مودم‌ها
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">تعداد کل</dt>
              <dd className="font-medium">{toPersianDigits(stats.modems.count)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">موجودی کم</dt>
              <dd className="font-medium text-[hsl(var(--warning))]">{toPersianDigits(stats.modems.lowStock)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">ناموجود</dt>
              <dd className="font-medium text-destructive">{toPersianDigits(stats.modems.outOfStock)}</dd>
            </div>
          </dl>
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href="/admin/modems">مدیریت مودم‌ها</Link>
          </Button>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageSquare className="h-4 w-4 text-primary" />
            پیامک و نمایندگان
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">پیامک موفق</dt>
              <dd className="font-medium">{toPersianDigits(stats.sms.sent)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">پیامک ناموفق</dt>
              <dd className="font-medium text-destructive">{toPersianDigits(stats.sms.failed)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">نماینده در انتظار تأیید</dt>
              <dd className="font-medium">{toPersianDigits(stats.resellers.pending)}</dd>
            </div>
          </dl>
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href="/admin/resellers">مدیریت نمایندگان</Link>
          </Button>
        </Card>
      </div>

      {stats.resellers.pending > 0 ? (
        <Card className="flex items-center gap-3 border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning))]" aria-hidden />
          <p>
            {toPersianDigits(stats.resellers.pending)} نماینده در انتظار تأیید هستند.{' '}
            <Link href="/admin/resellers?status=PENDING_APPROVAL" className="font-medium text-primary hover:underline">
              بررسی کنید
            </Link>
          </p>
        </Card>
      ) : null}

      <Card className="p-0">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">آخرین سفارش‌ها</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/orders">همه سفارش‌ها</Link>
          </Button>
        </div>
        {stats.recentOrders.length ? (
          <ul className="divide-y">
            {stats.recentOrders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div className="space-y-1">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium hover:text-primary" dir="ltr">
                    {order.orderNumber}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {order.customerName} — {formatJalaliDateTime(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Money value={order.total} withUnit={false} />
                  <Badge variant="secondary">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">سفارشی ثبت نشده است.</p>
        )}
      </Card>
    </div>
  );
}
