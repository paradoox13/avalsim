import { formatToman } from '@/lib/utils/money';

/** نمایش مبلغ به تومان با ارقام فارسی */
export function Money({
  value,
  className,
  withUnit = true,
}: {
  value: bigint | number | string;
  className?: string;
  withUnit?: boolean;
}) {
  const amount = typeof value === 'bigint' ? value : BigInt(Math.trunc(Number(value)));
  return (
    <span className={className} dir="rtl">
      {formatToman(amount, withUnit)}
    </span>
  );
}
