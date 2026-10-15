import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { getCartToken } from '@/lib/cart-session';
import { getCurrentUser } from '@/lib/auth/session';
import { getPublicSettings } from '@/lib/settings';
import { toPersianDigits } from '@/lib/utils/persian';
import { HeaderNav } from './header-nav';

const ZERO_BADGE = '۰';

async function CartBadge() {
  try {
    const token = await getCartToken();
    if (!token) return <>{ZERO_BADGE}</>;
    const count = await prisma.cartItem.aggregate({
      where: { cart: { token } },
      _sum: { quantity: true },
    });
    return <>{toPersianDigits(count._sum.quantity ?? 0)}</>;
  } catch {
    return <>{ZERO_BADGE}</>;
  }
}

async function HeaderContent() {
  const [settings, user] = await Promise.all([
    getPublicSettings().catch(() => ({}) as Record<string, string>),
    getCurrentUser().catch(() => null),
  ]);

  return (
    <HeaderNav
      siteName={settings['site.name'] ?? 'سیم‌شاپ'}
      phone={settings['site.phone'] ?? ''}
      user={user ? { fullName: user.fullName, roleKey: user.roleKey } : null}
      cartCount={
        <Suspense fallback={<>{ZERO_BADGE}</>}>
          <CartBadge />
        </Suspense>
      }
    />
  );
}

/** هدر فروشگاه (Server Component) */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Suspense fallback={<div className="container h-16" />}>
        <HeaderContent />
      </Suspense>
    </header>
  );
}

export function SiteLogo({ name }: { name: string }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label={name}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-sm font-bold text-white">
        س
      </span>
      <span className="text-lg font-bold">{name}</span>
    </Link>
  );
}
