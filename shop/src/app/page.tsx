import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft, ShieldCheck, Truck, Zap, Headphones, Sparkles, Phone, Wifi, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PhoneBrowser } from '@/components/site/phone-browser';
import { ActivationCalculator } from '@/components/site/activation-calculator';
import { ModemCard } from '@/components/site/modem-card';
import { listOperatorsWithPrices } from '@/lib/services/operator.service';
import { listModems } from '@/lib/services/modem.service';
import { getSettingNumber, getPublicSettings } from '@/lib/settings';
import { prisma } from '@/lib/prisma';
import { toPersianDigits } from '@/lib/utils/persian';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function safe<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.error('[home] data load failed:', error);
    return fallback;
  }
}

const FEATURES = [
  { icon: ShieldCheck, title: 'پرداخت امن', text: 'اتصال به درگاه‌های معتبر ایرانی و رمزنگاری کامل اطلاعات' },
  { icon: Zap, title: 'تحویل فوری', text: 'شماره‌های خریداری‌شده بلافاصله به نام شما ثبت می‌شوند' },
  { icon: Truck, title: 'ارسال سریع', text: 'مودم و کد فعال‌سازی با پست پیشتاز و تیپاکس ارسال می‌شود' },
  { icon: Headphones, title: 'پشتیبانی واقعی', text: 'پاسخ‌گویی کارشناسان در ساعات کاری، همه‌ی روزهای هفته' },
];

export default async function HomePage() {
  const [operators, modems, settings, maxQty, phoneStats] = await Promise.all([
    safe(() => listOperatorsWithPrices(), []),
    safe(() => listModems({ sort: 'newest', page: 1, limit: 8, inStock: true }, { forStorefront: true }), {
      items: [],
      total: 0,
      page: 1,
      limit: 8,
    }),
    safe(() => getPublicSettings(), {} as Record<string, string>),
    safe(() => getSettingNumber('shop.activationMaxQty'), 50),
    safe(
      async () => ({
        available: await prisma.phoneNumber.count({ where: { status: 'AVAILABLE', deletedAt: null } }),
        sold: await prisma.phoneNumber.count({ where: { status: 'SOLD', deletedAt: null } }),
      }),
      { available: 0, sold: 0 },
    ),
  ]);

  const operatorOptions = operators.map((op) => ({
    id: op.id,
    name: op.name,
    code: op.code,
    slug: op.slug,
    color: op.color,
  }));

  const activationOperators = operators
    .filter((op) => op.tiers.length > 0)
    .map((op) => ({
      id: op.id,
      name: op.name,
      code: op.code,
      color: op.color,
      tiers: op.tiers.map((t) => ({
        minQty: t.minQty,
        maxQty: t.maxQty,
        unitPrice: t.unitPrice,
      })),
    }));

  return (
    <div className="space-y-16 pb-10">
      {/* ——— هیرو ——— */}
      <section className="relative overflow-hidden border-b bg-gradient-to-bl from-accent/60 via-background to-background">
        <div className="container grid gap-8 py-14 lg:grid-cols-2 lg:py-20">
          <div className="animate-fade-in-up space-y-6">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              بیش از {toPersianDigits(phoneStats.sold)} معامله موفق
            </Badge>
            <h1 className="text-balance text-3xl font-bold leading-relaxed lg:text-4xl">
              خرید شماره سیم‌کارت، مودم و کد فعال‌سازی با پرداخت امن
            </h1>
            <p className="max-w-xl text-muted-foreground">
              {settings['site.tagline'] ??
                'مرجع خرید شماره‌های رند و معمولی همراه اول، ایرانسل و رایتل — همراه با فروش مودم و کد فعال‌سازی'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/phones">
                  مشاهده شماره‌ها
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/activation">خرید کد فعال‌سازی</Link>
              </Button>
            </div>
            <dl className="grid max-w-lg grid-cols-3 gap-4 pt-2">
              <div className="rounded-xl border bg-card p-3 text-center">
                <dt className="text-xs text-muted-foreground">شماره موجود</dt>
                <dd className="text-lg font-bold">{toPersianDigits(phoneStats.available)}</dd>
              </div>
              <div className="rounded-xl border bg-card p-3 text-center">
                <dt className="text-xs text-muted-foreground">اپراتور</dt>
                <dd className="text-lg font-bold">{toPersianDigits(operators.length)}</dd>
              </div>
              <div className="rounded-xl border bg-card p-3 text-center">
                <dt className="text-xs text-muted-foreground">محصولات</dt>
                <dd className="text-lg font-bold">{toPersianDigits(modems.total)}</dd>
              </div>
            </dl>
          </div>

          <div className="grid grid-cols-2 gap-4 self-center">
            {[
              { icon: Phone, title: 'شماره سیم‌کارت', text: 'رند، متوالی و آینه از همه اپراتورها', href: '/phones', color: 'from-teal-500/15' },
              { icon: Wifi, title: 'مودم', text: 'مودم‌های LTE و همراه با گارانتی', href: '/modems', color: 'from-sky-500/15' },
              { icon: KeyRound, title: 'کد فعال‌سازی', text: 'قیمت ویژه به تفکیک اپراتور', href: '/activation', color: 'from-amber-500/15' },
              { icon: ShieldCheck, title: 'پیگیری سفارش', text: 'با کد رهگیری، در هر زمان', href: '/track', color: 'from-violet-500/15' },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={`group rounded-xl border bg-gradient-to-br ${item.color} to-transparent p-4 transition-transform hover:-translate-y-1`}
              >
                <item.icon className="mb-2 h-6 w-6 text-primary" aria-hidden />
                <h2 className="text-sm font-semibold">{item.title}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ——— جستجوی شماره‌ها ——— */}
      <section className="container" id="phones">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">جستجوی پیشرفته شماره</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              با فیلترهای دقیق، شماره‌ی دلخواه خود را پیدا کنید
            </p>
          </div>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/phones">
              همه شماره‌ها
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <PhoneBrowser operators={operatorOptions} initialFilters={{ isRond: false }} limit={12} />
        </Suspense>
      </section>

      {/* ——— کدهای فعال‌سازی ——— */}
      <section className="border-y bg-muted/30 py-14" id="activation">
        <div className="container space-y-6">
          <div>
            <h2 className="text-xl font-bold">خرید کد فعال‌سازی</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              اپراتور و تعداد را انتخاب کنید؛ قیمت به‌صورت خودکار محاسبه می‌شود.
            </p>
          </div>
          <ActivationCalculator operators={activationOperators} maxQty={maxQty || 50} />
        </div>
      </section>

      {/* ——— مودم‌ها ——— */}
      <section className="container" id="modems">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">مودم و تجهیزات</h2>
            <p className="mt-1 text-sm text-muted-foreground">مودم‌های اورجینال با گارانتی معتبر</p>
          </div>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/modems">
              همه مودم‌ها
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {modems.items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {modems.items.map((modem) => (
              <ModemCard
                key={modem.id}
                modem={{
                  id: modem.id,
                  title: modem.title,
                  brand: modem.brand,
                  model: modem.model,
                  price: modem.price,
                  stock: modem.stock,
                  imageUrl: modem.imageUrl,
                  warranty: modem.warranty,
                }}
              />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            در حال حاضر مودمی برای فروش موجود نیست.
          </Card>
        )}
      </section>

      {/* ——— مزایا ——— */}
      <section className="container">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="p-5">
              <feature.icon className="mb-3 h-6 w-6 text-primary" aria-hidden />
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{feature.text}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
