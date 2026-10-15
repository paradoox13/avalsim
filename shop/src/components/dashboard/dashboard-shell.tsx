'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Menu,
  X,
  LogOut,
  Home,
  Phone,
  Wifi,
  KeyRound,
  FileSpreadsheet,
  BarChart3,
  Wallet,
  Users,
  ShoppingCart,
  Settings,
  ScrollText,
  MessageSquare,
  ClipboardList,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/site/theme-toggle';
import { cn } from '@/lib/utils/cn';
import { http } from '@/lib/client/api';
import { toPersianDigits } from '@/lib/utils/persian';

const ICONS = {
  dashboard: LayoutDashboard,
  phone: Phone,
  modem: Wifi,
  activation: KeyRound,
  import: FileSpreadsheet,
  reports: BarChart3,
  settlements: Wallet,
  users: Users,
  orders: ShoppingCart,
  settings: Settings,
  audit: ScrollText,
  sms: MessageSquare,
  logs: ClipboardList,
  store: Store,
} as const;

export type DashboardIcon = keyof typeof ICONS;

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: DashboardIcon;
  permission?: string;
}

export interface DashboardNavGroup {
  title: string;
  items: DashboardNavItem[];
}

/** پوسته‌ی مشترک پنل ادمین و نمایندگان (سایدبار + نوار بالا) */
export function DashboardShell({
  title,
  roleLabel,
  user,
  groups,
  permissions,
  children,
}: {
  title: string;
  roleLabel: string;
  user: { fullName: string; phone?: string };
  groups: DashboardNavGroup[];
  permissions?: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const canSee = (item: DashboardNavItem) =>
    !item.permission || !permissions || permissions.includes(item.permission) || permissions.includes('*');

  async function logout() {
    try {
      await http.post('/api/auth/logout');
    } catch {
      /* حتی اگر خطا داد، کاربر را به صفحه‌ی اصلی می‌بریم */
    }
    router.push('/');
    router.refresh();
  }

  const Nav = (
    <nav className="space-y-6" aria-label="منوی پنل">
      {groups.map((group) => {
        const items = group.items.filter(canSee);
        if (!items.length) return null;
        return (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
            <ul className="space-y-1">
              {items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        {/* سایدبار دسکتاپ */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-e bg-background p-4 lg:block">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-sm font-bold text-white">
              س
            </span>
            <div>
              <p className="text-sm font-bold">{title}</p>
              <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
          {Nav}
          <div className="mt-8 border-t pt-4">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              <Home className="h-4 w-4" />
              بازگشت به فروشگاه
            </Link>
          </div>
        </aside>

        <div className="flex min-h-screen w-full min-w-0 flex-col">
          {/* نوار بالا */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen((prev) => !prev)}
              aria-label="منو"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>

            <div className="ms-auto flex items-center gap-2">
              <ThemeToggle />
              <div className="hidden items-center gap-2 sm:flex">
                <Badge variant="secondary">{roleLabel}</Badge>
                <span className="text-sm">{user.fullName}</span>
              </div>
              {user.phone ? (
                <span className="hidden text-xs text-muted-foreground md:inline" dir="ltr">
                  {toPersianDigits(user.phone)}
                </span>
              ) : null}
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">خروج</span>
              </Button>
            </div>
          </header>

          {/* منوی موبایل */}
          {open ? (
            <div className="border-b bg-background p-4 lg:hidden">{Nav}</div>
          ) : null}

          <div className="min-w-0 flex-1 p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
