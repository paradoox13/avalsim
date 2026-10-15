import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ModemCard } from '@/components/site/modem-card';
import { listModems } from '@/lib/services/modem.service';
import { toPersianDigits } from '@/lib/utils/persian';

export const metadata: Metadata = {
  title: 'خرید مودم',
  description: 'خرید مودم LTE، همراه و ثابت با گارانتی معتبر و ارسال سریع',
};

export const dynamic = 'force-dynamic';

const SORT_LABELS = [
  { key: 'newest', label: 'جدیدترین' },
  { key: 'cheapest', label: 'ارزان‌ترین' },
  { key: 'expensive', label: 'گران‌ترین' },
  { key: 'popular', label: 'محبوب‌ترین' },
] as const;

export default async function ModemsPage({
  searchParams,
}: {
  searchParams: { sort?: string; page?: string; q?: string; brands?: string };
}) {
  const sort = (SORT_LABELS.find((s) => s.key === searchParams.sort)?.key ?? 'newest') as
    | 'newest'
    | 'cheapest'
    | 'expensive'
    | 'popular';
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);

  let result = { items: [] as Awaited<ReturnType<typeof listModems>>['items'], total: 0, page, limit: 12 };
  try {
    result = await listModems(
      {
        sort,
        page,
        limit: 12,
        inStock: true,
        q: searchParams.q,
        brands: searchParams.brands?.split(',').filter(Boolean),
      },
      { forStorefront: true },
    );
  } catch (error) {
    console.error('[modems] load failed:', error);
  }

  const pages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <div className="container space-y-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">مودم و تجهیزات شبکه</h1>
          <p className="text-sm text-muted-foreground">
            {toPersianDigits(result.total)} محصول موجود
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SORT_LABELS.map((item) => (
            <Button
              key={item.key}
              asChild
              size="sm"
              variant={item.key === sort ? 'default' : 'outline'}
            >
              <Link href={`/modems?sort=${item.key}`}>{item.label}</Link>
            </Button>
          ))}
        </div>
      </header>

      {result.items.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.items.map((modem) => (
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

          {pages > 1 ? (
            <nav className="flex items-center justify-center gap-2" aria-label="صفحه‌بندی">
              {Array.from({ length: pages }).map((_, index) => {
                const target = index + 1;
                return (
                  <Button
                    key={target}
                    asChild
                    size="sm"
                    variant={target === page ? 'default' : 'outline'}
                  >
                    <Link href={`/modems?sort=${sort}&page=${target}`}>{toPersianDigits(target)}</Link>
                  </Button>
                );
              })}
            </nav>
          ) : null}
        </>
      ) : (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          در حال حاضر مودمی برای فروش موجود نیست.
        </Card>
      )}
    </div>
  );
}
