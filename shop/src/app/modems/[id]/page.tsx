import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/site/money';
import { ModemCard } from '@/components/site/modem-card';
import { getModemById, listModems } from '@/lib/services/modem.service';
import { toPersianDigits } from '@/lib/utils/persian';
import { ArrowRight, Package, ShieldCheck, Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const modem = await getModemById(params.id);
    return { title: modem.title, description: modem.description ?? `${modem.brand} ${modem.model}` };
  } catch {
    return { title: 'محصول یافت نشد' };
  }
}

export default async function ModemDetailPage({ params }: { params: { id: string } }) {
  let modem: Awaited<ReturnType<typeof getModemById>>;
  try {
    modem = await getModemById(params.id);
  } catch {
    notFound();
  }

  const related = await listModems(
    { sort: 'newest', page: 1, limit: 4, inStock: true, brands: [modem.brand] },
    { forStorefront: true },
  ).catch(() => ({ items: [], total: 0, page: 1, limit: 4 }));

  const specs = (modem.specs as Record<string, string> | null) ?? {};

  return (
    <div className="container space-y-8 py-8">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="مسیر صفحه">
        <Link href="/" className="hover:text-primary">خانه</Link>
        <ArrowRight className="h-3.5 w-3.5" />
        <Link href="/modems" className="hover:text-primary">مودم</Link>
        <ArrowRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{modem.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="relative aspect-square overflow-hidden bg-muted">
          {modem.imageUrl ? (
            <Image
              src={modem.imageUrl}
              alt={modem.title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Package className="h-16 w-16" aria-hidden />
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{modem.brand}</Badge>
            <Badge variant="secondary">{modem.model}</Badge>
            {modem.stock > 0 ? (
              <Badge variant="success">موجود در انبار ({toPersianDigits(modem.stock)})</Badge>
            ) : (
              <Badge variant="destructive">ناموجود</Badge>
            )}
          </div>

          <h1 className="text-2xl font-bold leading-relaxed">{modem.title}</h1>

          <div className="flex items-center justify-between rounded-xl border bg-card p-4">
            <Money value={modem.price} className="text-2xl font-bold text-primary" />
            <ModemCard
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
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="rounded-lg border p-3">
              <ShieldCheck className="mx-auto mb-1 h-5 w-5 text-primary" aria-hidden />
              {modem.warranty ?? 'گارانتی معتبر'}
            </div>
            <div className="rounded-lg border p-3">
              <Truck className="mx-auto mb-1 h-5 w-5 text-primary" aria-hidden />
              ارسال سریع
            </div>
            <div className="rounded-lg border p-3">
              <Package className="mx-auto mb-1 h-5 w-5 text-primary" aria-hidden />
              اصالت کالا
            </div>
          </div>

          {modem.description ? (
            <div className="space-y-2">
              <h2 className="font-semibold">توضیحات</h2>
              <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {modem.description}
              </p>
            </div>
          ) : null}

          {Object.keys(specs).length ? (
            <div className="space-y-2">
              <h2 className="font-semibold">مشخصات فنی</h2>
              <dl className="divide-y rounded-lg border text-sm">
                {Object.entries(specs).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4 p-3">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>

      {related.items.filter((m) => m.id !== modem.id).length ? (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">محصولات مشابه</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.items
              .filter((m) => m.id !== modem.id)
              .slice(0, 4)
              .map((item) => (
                <ModemCard
                  key={item.id}
                  modem={{
                    id: item.id,
                    title: item.title,
                    brand: item.brand,
                    model: item.model,
                    price: item.price,
                    stock: item.stock,
                    imageUrl: item.imageUrl,
                    warranty: item.warranty,
                  }}
                />
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
