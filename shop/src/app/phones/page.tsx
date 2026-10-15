import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PhoneBrowser } from '@/components/site/phone-browser';
import { listOperatorsWithPrices } from '@/lib/services/operator.service';

export const metadata: Metadata = {
  title: 'خرید شماره سیم‌کارت',
  description:
    'جستجوی پیشرفته شماره سیم‌کارت همراه اول، ایرانسل، رایتل و سایر اپراتورها با فیلتر رند، متوالی، تکراری و بازه قیمت',
};

export const dynamic = 'force-dynamic';

export default async function PhonesPage() {
  let operators: Awaited<ReturnType<typeof listOperatorsWithPrices>> = [];
  try {
    operators = await listOperatorsWithPrices();
  } catch (error) {
    console.error('[phones] operators load failed:', error);
  }

  return (
    <div className="container space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">خرید شماره سیم‌کارت</h1>
        <p className="text-sm text-muted-foreground">
          با فیلترهای پیشرفته، شماره‌ی متناسب با بودجه و سلیقه‌ی خود را انتخاب کنید. شماره‌های فروخته‌شده
          به‌صورت خودکار از فهرست حذف می‌شوند.
        </p>
      </header>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PhoneBrowser
          operators={operators.map((op) => ({
            id: op.id,
            name: op.name,
            code: op.code,
            slug: op.slug,
            color: op.color,
          }))}
          limit={24}
        />
      </Suspense>
    </div>
  );
}
