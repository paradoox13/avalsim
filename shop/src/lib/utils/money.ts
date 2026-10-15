import { formatPersianNumber, toEnglishDigits, toPersianDigits } from './persian';

/**
 * واحد پول پروژه: تومان.
 * از BigInt استفاده می‌کنیم تا مبالغ بزرگ (شماره‌های رند گران‌قیمت، سفارش عمده)
 * بدون خطر سرریز عدد صحیح یا خطای اعشاری شناور نگهداری شوند.
 */
export type Toman = bigint;

const MAX_AMOUNT = 10n ** 15n; // سقف امنیتی: ۱ کوآدریلیون تومان

export function toToman(value: bigint | number | string): Toman {
  let result: bigint;
  if (typeof value === 'bigint') {
    result = value;
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('مبلغ نامعتبر است');
    result = BigInt(Math.round(value));
  } else {
    const cleaned = toEnglishDigits(value).replace(/[^\d-]/g, '');
    if (!cleaned || cleaned === '-') throw new Error('مبلغ نامعتبر است');
    result = BigInt(cleaned);
  }
  if (result < 0n) throw new Error('مبلغ نمی‌تواند منفی باشد');
  if (result > MAX_AMOUNT) throw new Error('مبلغ بیش از حد مجاز است');
  return result;
}

export function mulToman(price: Toman, quantity: number): Toman {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('تعداد نامعتبر است');
  return price * BigInt(quantity);
}

export function sumToman(values: readonly Toman[]): Toman {
  return values.reduce<Toman>((acc, v) => acc + v, 0n);
}

/**
 * درصد بر مبنای basis point (۵۰۰ = ۵٪) با گردکردن نیم‌به‌بالا.
 * basis point کمیسیون‌ها را دقیق و بدون اعشار نگه می‌دارد.
 */
export function basisPointsOf(amount: Toman, basisPoints: number): Toman {
  if (!Number.isInteger(basisPoints) || basisPoints < 0) throw new Error('نرخ نامعتبر است');
  const numerator = amount * BigInt(basisPoints);
  const divisor = 10000n;
  return (numerator + divisor / 2n) / divisor;
}

export function taxOf(amount: Toman, vatBasisPoints: number): Toman {
  return basisPointsOf(amount, vatBasisPoints);
}

/** نمایش: «۱٫۲۵۰٫۰۰۰ تومان» */
export function formatToman(amount: Toman | number | bigint, withUnit = true): string {
  const big = typeof amount === 'bigint' ? amount : BigInt(Math.trunc(amount));
  const sign = big < 0n ? '-' : '';
  const formatted = formatPersianNumber(big < 0n ? -big : big);
  return withUnit ? `${sign}${formatted} تومان` : `${sign}${formatted}`;
}

/** نمایش خلاصه: «۱٫۲ میلیون تومان» */
export function formatTomanCompact(amount: Toman | number | bigint): string {
  const big = typeof amount === 'bigint' ? amount : BigInt(Math.trunc(amount));
  const negative = big < 0n;
  const abs = negative ? -big : big;
  const units: ReadonlyArray<readonly [bigint, string]> = [
    [1_000_000_000_000n, 'هزار میلیارد'],
    [1_000_000_000n, 'میلیارد'],
    [1_000_000n, 'میلیون'],
    [1_000n, 'هزار'],
  ];
  for (const [threshold, label] of units) {
    if (abs >= threshold) {
      const scaled = (abs * 10n) / threshold; // یک رقم اعشار
      const intPart = scaled / 10n;
      const decPart = scaled % 10n;
      const body =
        decPart === 0n
          ? toPersianDigits(intPart.toString())
          : `${toPersianDigits(intPart.toString())}٫${toPersianDigits(decPart.toString())}`;
      return `${negative ? '-' : ''}${body} ${label} تومان`;
    }
  }
  return formatToman(big);
}

/** BigInt قابل سریالایز در JSON نیست — برای پاسخ‌های API رشته می‌فرستیم */
export function serializeToman(amount: Toman | bigint): string {
  return amount.toString();
}
