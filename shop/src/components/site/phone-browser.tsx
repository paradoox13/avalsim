'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PhoneCard, type PhoneCardData } from './phone-card';
import { INITIAL_FILTERS, PhoneFilters, type OperatorOption, type PhoneFiltersState } from './phone-filters';
import { http } from '@/lib/client/api';
import { toPersianDigits } from '@/lib/utils/persian';
import type { CartView } from '@/lib/services/cart.service';

function filtersToQuery(filters: PhoneFiltersState): string {
  const params = new URLSearchParams();
  if (filters.operators.length) params.set('operators', filters.operators.join(','));
  if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
  if (filters.prefix) params.set('prefix', filters.prefix);
  if (filters.suffix) params.set('suffix', filters.suffix);
  if (filters.pattern) params.set('pattern', filters.pattern);
  if (filters.isRond) params.set('isRond', 'true');
  if (filters.isSequential) params.set('isSequential', 'true');
  if (filters.isRepeated) params.set('isRepeated', 'true');
  if (filters.isPalindrome) params.set('isPalindrome', 'true');
  if (filters.digits) params.set('digits', String(filters.digits));
  if (filters.q) params.set('q', filters.q);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  return params.toString();
}

/**
 * مرور و جستجوی شماره‌ها با بارگذاری تدریجی.
 * وضعیت فیلترها در URL ذخیره می‌شود تا لینک قابل اشتراک باشد.
 */
export function PhoneBrowser({
  operators,
  initialFilters,
  onCartChange,
  limit = 24,
}: {
  operators: OperatorOption[];
  initialFilters?: Partial<PhoneFiltersState>;
  onCartChange?: (cart: CartView) => void;
  limit?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<PhoneFiltersState>(() => ({
    ...INITIAL_FILTERS,
    ...initialFilters,
    q: searchParams.get('q') ?? initialFilters?.q ?? '',
  }));
  const [items, setItems] = useState<PhoneCardData[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const query = useMemo(() => filtersToQuery(filters), [filters]);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams(query);
        params.set('page', String(targetPage));
        params.set('limit', String(limit));
        // نکته: پاسخ این اندپوینت آرایه‌ی مستقیم شماره‌هاست (نه { items })
        const result = await http.get<PhoneCardData[]>(`/api/products/phones?${params.toString()}`);
        const batch = Array.isArray(result.data) ? result.data : [];
        setItems((prev) => (append ? [...prev, ...batch] : batch));
        setTotal(result.meta?.total ?? batch.length);
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'خطا در دریافت شماره‌ها');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, limit],
  );

  // بارگذاری اولیه و با هر تغییر فیلتر (با debounce برای تایپ)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load(1, false);
      router.replace(`?${query}`, { scroll: false });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, load, router]);

  // بارگذاری تدریجی هنگام اسکرول
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !loadingMore && items.length < total) {
          load(page + 1, true);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length, total, page, loading, loadingMore, load]);

  const hasMore = items.length < total;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <PhoneFilters
        operators={operators}
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onReset={() => setFilters({ ...INITIAL_FILTERS, q: filters.q })}
        resultCount={total}
      />

      <div className="space-y-4">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="p-4">
                <Skeleton className="mb-3 h-5 w-20" />
                <Skeleton className="mx-auto mb-3 h-7 w-40" />
                <Skeleton className="h-9 w-full" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button className="mt-4" variant="outline" onClick={() => load(1, false)}>
              تلاش دوباره
            </Button>
          </Card>
        ) : items.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <PackageSearch className="h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="font-medium">شماره‌ای با این مشخصات پیدا نشد</p>
            <p className="text-sm text-muted-foreground">
              فیلترها را ساده‌تر کنید یا الگوی عددی دیگری امتحان کنید.
            </p>
            <Button variant="outline" onClick={() => setFilters({ ...INITIAL_FILTERS })}>
              پاک‌کردن فیلترها
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((phone) => (
                <PhoneCard key={phone.id} phone={phone} onAdded={onCartChange} />
              ))}
            </div>

            <div ref={loadMoreRef} className="flex flex-col items-center gap-3 py-4">
              {hasMore ? (
                <Button
                  variant="outline"
                  onClick={() => load(page + 1, true)}
                  loading={loadingMore}
                  aria-label="نمایش شماره‌های بیشتر"
                >
                  نمایش شماره‌های بیشتر
                </Button>
              ) : null}
              <p className="text-xs text-muted-foreground">
                نمایش {toPersianDigits(items.length)} از {toPersianDigits(total)} شماره
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
