import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/site/money';
import { requireApprovedReseller } from '@/lib/guards';
import { phoneStats } from '@/lib/services/phone.service';
import { getResellerFinancials } from '@/lib/services/settlement.service';
import { prisma } from '@/lib/prisma';
import { toPersianDigits } from '@/lib/utils/persian';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { Package, TrendingUp, Wallet, Smartphone } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ResellerDashboardPage() {
  const { resellerId, userId } = await requireApprovedReseller();

  const [stats, financials, modemCount, recent] = await Promise.all([
    phoneStats({ resellerId }),
    getResellerFinancials(resellerId),
    prisma.modem.count({ where: { resellerId, deletedAt: null } }),
    prisma.orderItem.findMany({
      where: { resellerId: userId },
      include: { order: { select: { orderNumber: true, status: true, paidAt: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  const cards = [
    {
      title: 'شماره‌های موجود',
      value: toPersianDigits(stats.counts.AVAILABLE),
      icon: Smartphone,
      hint: `فروخته‌شده: ${toPersianDigits(stats.counts.SOLD)} | رزرو: ${toPersianDigits(stats.counts.RESERVED)}`,
    },
    {
      title: 'مودم‌های ثبت‌شده',
      value: toPersianDigits(modemCount),
      icon: Package,
      hint: 'محصولات فعال و غیرفعال',
    },
    {
      title: 'مجموع فروش',
      value: <Money value={financials.totalSales} />,
      icon: TrendingUp,
      hint: `${toPersianDigits(financials.soldItemsCount)} محصول فروخته‌شده`,
    },
    {
      title: 'مانده قابل تسویه',
      value: <Money value={financials.balance} />,
      icon: Wallet,
      hint: `کمیسیون کل: ${toPersianDigits(0)}`,
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

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/reseller/phones">مدیریت شماره‌ها</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/reseller/import">ایمپورت اکسل</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/reseller/settlements">درخواست تسویه</Link>
        </Button>
      </div>

      <Card className="p-0">
        <div className="border-b p-4">
          <h2 className="font-semibold">آخرین فروش‌ها</h2>
        </div>
        {recent.length ? (
          <ul className="divide-y">
            {recent.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    سفارش <span dir="ltr">{item.order.orderNumber}</span>
                    {item.order.paidAt ? ` — ${formatJalaliDateTime(item.order.paidAt)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Money value={item.totalPrice} withUnit={false} />
                  <Badge variant="secondary">
                    کمیسیون <Money value={item.commissionAmount} withUnit={false} />
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">هنوز فروشی ثبت نشده است.</p>
        )}
      </Card>
    </div>
  );
}
