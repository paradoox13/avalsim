'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { formatToman } from '@/lib/utils/money';

export interface OperatorOption {
  id: string;
  name: string;
  code: string;
  slug?: string;
  color: string;
}

export interface PhoneFiltersState {
  operators: string[];
  minPrice?: number;
  maxPrice?: number;
  prefix: string;
  suffix: string;
  pattern: string;
  isRond: boolean;
  isSequential: boolean;
  isRepeated: boolean;
  isPalindrome: boolean;
  digits?: number;
  q: string;
  sort: 'newest' | 'cheapest' | 'expensive' | 'popular' | 'rond';
}

export const INITIAL_FILTERS: PhoneFiltersState = {
  operators: [],
  prefix: '',
  suffix: '',
  pattern: '',
  isRond: false,
  isSequential: false,
  isRepeated: false,
  isPalindrome: false,
  q: '',
  sort: 'newest',
};

export const PRICE_MIN = 0;
export const PRICE_MAX = 500_000_000;
const PRICE_STEP = 1_000_000;

/** فیلترهای پیشرفته‌ی شماره — کاملاً راست‌چین و واکنش‌گرا */
export function PhoneFilters({
  operators,
  filters,
  onChange,
  onReset,
  resultCount,
}: {
  operators: OperatorOption[];
  filters: PhoneFiltersState;
  onChange: (patch: Partial<PhoneFiltersState>) => void;
  onReset: () => void;
  resultCount?: number;
}) {
  const priceRange: [number, number] = [filters.minPrice ?? PRICE_MIN, filters.maxPrice ?? PRICE_MAX];

  const activeCount =
    filters.operators.length +
    (filters.isRond ? 1 : 0) +
    (filters.isSequential ? 1 : 0) +
    (filters.isRepeated ? 1 : 0) +
    (filters.isPalindrome ? 1 : 0) +
    (filters.prefix ? 1 : 0) +
    (filters.suffix ? 1 : 0) +
    (filters.pattern ? 1 : 0) +
    (filters.minPrice || filters.maxPrice ? 1 : 0);

  return (
    <aside className="space-y-5 rounded-xl border bg-card p-5" aria-label="فیلترهای پیشرفته">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Filter className="h-4 w-4" />
          فیلترهای پیشرفته
          {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
        </h2>
        <Button variant="ghost" size="sm" onClick={onReset} type="button">
          <RotateCcw className="h-3.5 w-3.5" />
          پاک‌سازی
        </Button>
      </div>

      {typeof resultCount === 'number' ? (
        <p className="text-xs text-muted-foreground">
          {formatToman(BigInt(resultCount), false).replace(/٫/g, '')} شماره یافت شد
        </p>
      ) : null}

      {/* جستجوی سریع */}
      <div className="space-y-2">
        <Label htmlFor="q">جستجوی سریع</Label>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="q"
            dir="ltr"
            placeholder="0912… یا بخشی از شماره"
            className="pr-9"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
          />
        </div>
      </div>

      {/* اپراتور */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">اپراتور</legend>
        <div className="grid grid-cols-2 gap-2">
          {operators.map((op) => {
            const checked = filters.operators.includes(op.code) || (op.slug ? filters.operators.includes(op.slug) : false);
            return (
              <label
                key={op.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-xs transition-colors hover:bg-accent"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => {
                    const next = value
                      ? [...filters.operators, op.code]
                      : filters.operators.filter((c) => c !== op.code && c !== op.slug);
                    onChange({ operators: next });
                  }}
                  aria-label={op.name}
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: op.color }} aria-hidden />
                <span>{op.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* بازه قیمت */}
      <div className="space-y-3">
        <Label>بازه قیمت (تومان)</Label>
        <Slider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={priceRange}
          onValueChange={([min, max]) => onChange({ minPrice: min, maxPrice: max })}
          aria-label="بازه قیمت"
        />
        <div className="flex items-center gap-2">
          <Input
            dir="ltr"
            inputMode="numeric"
            className="h-9 text-xs"
            placeholder="از"
            value={filters.minPrice ?? ''}
            onChange={(e) => onChange({ minPrice: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : undefined })}
            aria-label="حداقل قیمت"
          />
          <span className="text-muted-foreground">تا</span>
          <Input
            dir="ltr"
            inputMode="numeric"
            className="h-9 text-xs"
            placeholder="تا"
            value={filters.maxPrice ?? ''}
            onChange={(e) => onChange({ maxPrice: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : undefined })}
            aria-label="حداکثر قیمت"
          />
        </div>
      </div>

      {/* پیش‌شماره و پسوند */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="prefix">پیش‌شماره</Label>
          <Input
            id="prefix"
            dir="ltr"
            maxLength={4}
            placeholder="0912"
            value={filters.prefix}
            onChange={(e) => onChange({ prefix: e.target.value.replace(/\D/g, '') })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="suffix">پسوند (۴ رقم آخر)</Label>
          <Input
            id="suffix"
            dir="ltr"
            maxLength={4}
            placeholder="1234"
            value={filters.suffix}
            onChange={(e) => onChange({ suffix: e.target.value.replace(/\D/g, '') })}
          />
        </div>
      </div>

      {/* الگوی عددی */}
      <div className="space-y-2">
        <Label htmlFor="pattern">الگوی عددی خاص</Label>
        <Input
          id="pattern"
          dir="ltr"
          placeholder="0912***1111"
          value={filters.pattern}
          onChange={(e) => onChange({ pattern: e.target.value })}
        />
        <p className="text-[11px] leading-5 text-muted-foreground">
          <code>*</code> = هر تعداد رقم، <code>?</code> = دقیقاً یک رقم. مثال: <code>0912?11*</code>
        </p>
      </div>

      {/* ویژگی‌ها */}
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">ویژگی شماره</legend>
        {[
          { key: 'isRond' as const, label: 'فقط شماره‌های رند' },
          { key: 'isSequential' as const, label: 'شماره‌های متوالی' },
          { key: 'isRepeated' as const, label: 'شماره‌های تکراری' },
          { key: 'isPalindrome' as const, label: 'شماره‌های آینه' },
        ].map((item) => (
          <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={filters[item.key]}
              onCheckedChange={(value) => onChange({ [item.key]: Boolean(value) } as Partial<PhoneFiltersState>)}
              aria-label={item.label}
            />
            {item.label}
          </label>
        ))}
      </fieldset>

      {/* تعداد ارقام و مرتب‌سازی */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="digits">تعداد ارقام</Label>
          <Select
            value={filters.digits ? String(filters.digits) : 'all'}
            onValueChange={(value) => onChange({ digits: value === 'all' ? undefined : Number(value) })}
          >
            <SelectTrigger id="digits">
              <SelectValue placeholder="همه" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="11">۱۱ رقم</SelectItem>
              <SelectItem value="10">۱۰ رقم</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sort">مرتب‌سازی</Label>
          <Select value={filters.sort} onValueChange={(value) => onChange({ sort: value as PhoneFiltersState['sort'] })}>
            <SelectTrigger id="sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">جدیدترین</SelectItem>
              <SelectItem value="cheapest">ارزان‌ترین</SelectItem>
              <SelectItem value="expensive">گران‌ترین</SelectItem>
              <SelectItem value="popular">محبوب‌ترین</SelectItem>
              <SelectItem value="rond">رندترین</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </aside>
  );
}
