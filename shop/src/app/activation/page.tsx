import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { ActivationCalculator } from '@/components/site/activation-calculator';
import { listOperatorsWithPrices } from '@/lib/services/operator.service';
import { getSettingNumber } from '@/lib/settings';
import { Info } from 'lucide-react';

export const metadata: Metadata = {
  title: 'خرید کد فعال‌سازی',
  description: 'خرید کد فعال‌سازی همراه اول، ایرانسل، رایتل و سایر اپراتورها با قیمت ویژه و پله‌ای',
};

export const dynamic = 'force-dynamic';

const STEPS = [
  'اپراتور مورد نظر خود را انتخاب کنید.',
  'تعداد کد مورد نیاز را وارد کنید؛ قیمت به‌صورت خودکار محاسبه می‌شود.',
  'به درگاه پرداخت هدایت می‌شوید و پس از پرداخت موفق، سفارش ثبت می‌گردد.',
  'کد فعال‌سازی پس از تأیید پرداخت برای شما ارسال می‌شود.',
];

export default async function ActivationPage() {
  let operators: Awaited<ReturnType<typeof listOperatorsWithPrices>> = [];
  let maxQty = 50;
  try {
    [operators, maxQty] = await Promise.all([
      listOperatorsWithPrices(),
      getSettingNumber('shop.activationMaxQty'),
    ]);
  } catch (error) {
    console.error('[activation] load failed:', error);
  }

  const activationOperators = operators
    .filter((op) => op.tiers.length > 0)
    .map((op) => ({
      id: op.id,
      name: op.name,
      code: op.code,
      color: op.color,
      tiers: op.tiers.map((t) => ({ minQty: t.minQty, maxQty: t.maxQty, unitPrice: t.unitPrice })),
    }));

  return (
    <div className="container space-y-8 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">خرید کد فعال‌سازی</h1>
        <p className="text-sm text-muted-foreground">
          قیمت کدهای فعال‌سازی بر اساس اپراتور و تعداد، پله‌ای محاسبه می‌شود.
        </p>
      </header>

      <Card className="border-primary/30 bg-accent/40 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Info className="h-4 w-4" />
          مراحل خرید
        </h2>
        <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </Card>

      <ActivationCalculator
        operators={activationOperators}
        maxQty={maxQty || 50}
      />
    </div>
  );
}
