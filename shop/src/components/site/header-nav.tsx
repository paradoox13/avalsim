'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Menu, Search, ShoppingCart, User, X, LayoutDashboard, LogOut, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from './theme-toggle';
import { cn } from '@/lib/utils/cn';
import { toPersianDigits } from '@/lib/utils/persian';

const NAV_LINKS = [
  { href: '/', label: 'خانه' },
  { href: '/phones', label: 'خرید شماره' },
  { href: '/modems', label: 'مودم' },
  { href: '/activation', label: 'کد فعال‌سازی' },
  { href: '/track', label: 'پیگیری سفارش' },
  { href: '/about', label: 'درباره ما' },
  { href: '/contact', label: 'تماس با ما' },
];

export interface HeaderNavProps {
  siteName: string;
  phone: string;
  user: { fullName: string; roleKey: string } | null;
  /** محتوای نشان سبد خرید — از سرور به‌صورت استریم‌شده می‌آید */
  cartCount: ReactNode;
}

/** ناوبری هدر: جستجو، سبد خرید، منوی کاربر و منوی موبایل */
export function HeaderNav({ siteName, phone, user, cartCount }: HeaderNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  const dashHref = user?.roleKey === 'ADMIN' || user?.roleKey === 'SUPER_ADMIN'
    ? '/admin'
    : user?.roleKey === 'RESELLER'
      ? '/reseller'
      : '/account';

  function onSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    router.push(`/phones?q=${encodeURIComponent(value)}`);
    setMobileOpen(false);
  }

  return (
    <div className="container flex h-16 items-center gap-3">
      <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={siteName}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-sm font-bold text-white">
          س
        </span>
        <span className="hidden text-lg font-bold sm:block">{siteName}</span>
      </Link>

      <nav className="hidden items-center gap-1 lg:flex" aria-label="منوی اصلی">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              pathname === link.href && 'bg-accent text-accent-foreground',
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <form onSubmit={onSearch} className="ms-auto hidden max-w-xs flex-1 md:block" role="search">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی شماره (مثلاً 0912)"
            className="pr-9"
            aria-label="جستجوی سریع"
            dir="ltr"
          />
        </div>
      </form>

      <div className="ms-auto flex items-center gap-1 md:ms-0">
        <ThemeToggle />

        <Button variant="ghost" size="icon" asChild aria-label="سبد خرید">
          <Link href="/cart" className="relative">
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute -left-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[18px] text-primary-foreground">
              {cartCount ?? '۰'}
            </span>
          </Link>
        </Button>

        {user ? (
          <div className="relative hidden sm:block">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
                <User className="h-4 w-4" />
                <span className="max-w-[100px] truncate">{user.fullName}</span>
              </summary>
              <div className="absolute left-0 z-50 mt-1 w-52 overflow-hidden rounded-lg border bg-popover p-1 shadow-lg">
                <Link href={dashHref} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent">
                  <LayoutDashboard className="h-4 w-4" /> پنل کاربری
                </Link>
                <Link href="/account/orders" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent">
                  <Package className="h-4 w-4" /> سفارش‌های من
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="button"
                    onClick={async () => {
                      const csrf = await fetch('/api/auth/csrf').then((r) => r.json()).then((d) => d.data.csrfToken);
                      await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: { 'x-csrf-token': csrf },
                      });
                      window.location.href = '/';
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent"
                  >
                    <LogOut className="h-4 w-4" /> خروج
                  </button>
                </form>
              </div>
            </details>
          </div>
        ) : (
          <div className="hidden items-center gap-1 sm:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">ورود</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">ثبت‌نام</Link>
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="منو"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen ? (
        <div className="absolute inset-x-0 top-16 z-40 border-b bg-background p-4 shadow-lg lg:hidden">
          <form onSubmit={onSearch} className="mb-3" role="search">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی شماره"
                className="pr-9"
                dir="ltr"
              />
            </div>
          </form>
          <nav className="grid gap-1" aria-label="منوی موبایل">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
            {!user ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" asChild>
                  <Link href="/login" onClick={() => setMobileOpen(false)}>ورود</Link>
                </Button>
                <Button asChild>
                  <Link href="/register" onClick={() => setMobileOpen(false)}>ثبت‌نام</Link>
                </Button>
              </div>
            ) : (
              <Link href={dashHref} onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-accent">
                پنل کاربری
              </Link>
            )}
            <Link href="/reseller/login" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm text-primary hover:bg-accent">
              ورود نمایندگان
            </Link>
          </nav>
          {phone ? (
            <p className="mt-3 text-center text-xs text-muted-foreground" dir="ltr">
              {toPersianDigits(phone)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
