// @vitest-environment jsdom
/**
 * رگرسیون: مرورگر شماره‌ها باید پاسخ `/api/products/phones` را درست بخواند.
 * این اندپوینت آرایه‌ی مستقیم برمی‌گرداند («data: [...]») و نه «data.items».
 * خواندن فیلد ناموجود باعث می‌شد state با undefined مقدار بگیرد و رندر کل صفحه
 * با خطای «Cannot read properties of undefined (reading 'length')» سفید شود.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** در اپ واقعی useRouter یک شیء پایدار برمی‌گرداند؛ پس mock هم باید پایدار باشد. */
const routerStub = { replace: vi.fn(), push: vi.fn(), prefetch: vi.fn(), back: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => routerStub,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/phones',
}));

const PHONES = [
  {
    id: 'phone-1',
    msisdn: '09121234567',
    price: '2500000',
    operator: { name: 'همراه اول', code: 'MCI', color: '#0ea5e9' },
    isRond: false,
    isSequential: true,
    isRepeated: false,
    isPalindrome: false,
    rondScore: 30,
    description: null,
  },
  {
    id: 'phone-2',
    msisdn: '09351112233',
    price: '1800000',
    operator: { name: 'ایرانسل', code: 'MTN', color: '#f59e0b' },
    isRond: false,
    isSequential: false,
    isRepeated: true,
    isPalindrome: false,
    rondScore: 10,
    description: null,
  },
];

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function envelope(data: unknown, total: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      data,
      meta: { page: 1, limit: 24, total, pages: Math.ceil(total / 24) },
    }),
  };
}

/** mount و سپس اجازه‌دادن به debounce (۳۰۰ms) و fetch تا کامل شوند */
async function mountAndSettle(container: HTMLDivElement): Promise<Root> {
  const { PhoneBrowser } = await import('@/components/site/phone-browser');
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(PhoneBrowser, { operators: [], limit: 24 }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
  });
  return root as unknown as Root;
}

describe('PhoneBrowser — قرارداد پاسخ API', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('IntersectionObserver', ObserverStub);
    vi.stubGlobal('ResizeObserver', ObserverStub);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    container.remove();
    vi.unstubAllGlobals();
    routerStub.replace.mockClear();
  });

  it('آرایه‌ی بازگشتی را رندر می‌کند و شمارنده‌ی کل را از meta می‌خواند', async () => {
    const fetchMock = vi.fn(async (_url: string) => envelope(PHONES, 25));
    vi.stubGlobal('fetch', fetchMock);

    root = await mountAndSettle(container);

    const text = container.textContent ?? '';
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/products/phones');
    // کارت‌ها با شماره‌های واقعی پاسخ رندر شده‌اند (ارقام فارسی)
    expect(text).toContain('۰۹۱۲ - ۱۲۳ - ۴۵۶۷');
    expect(text).toContain('۰۹۳۵ - ۱۱۱ - ۲۲۳۳');
    // «۲۵» از meta خوانده شده، نه از طول آرایه
    expect(text).toMatch(/نمایش\s[\u06F0-\u06F9]+\sاز\s[\u06F0-\u06F9]+\sشماره/);
    expect(text.replace(/\s/g, '')).toContain('۲۵');
    expect(routerStub.replace).toHaveBeenCalled();
  });

  it('اگر اندپوینت آرایه برنگرداند، لیست خالی می‌ماند و رندر نمی‌شکند', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) => envelope(undefined, 0)),
    );

    root = await mountAndSettle(container);

    const text = container.textContent ?? '';
    expect(text).toContain('شماره‌ای با این مشخصات پیدا نشد');
  });
});
