import Link from 'next/link';
import { getPublicSettings } from '@/lib/settings';
import { toPersianDigits } from '@/lib/utils/persian';
import { formatJalaliDate } from '@/lib/utils/jalali';

const QUICK_LINKS = [
  { href: '/phones', label: 'خرید شماره سیم‌کارت' },
  { href: '/modems', label: 'خرید مودم' },
  { href: '/activation', label: 'کد فعال‌سازی' },
  { href: '/track', label: 'پیگیری سفارش' },
];

const SUPPORT_LINKS = [
  { href: '/faq', label: 'سوالات متداول' },
  { href: '/terms', label: 'قوانین و مقررات' },
  { href: '/privacy', label: 'حریم خصوصی' },
  { href: '/contact', label: 'تماس با ما' },
];

/** فوتر فروشگاه */
export async function SiteFooter() {
  const settings = await getPublicSettings().catch(() => ({}) as Record<string, string>);
  const name = settings['site.name'] ?? 'سیم‌شاپ';
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t bg-muted/40">
      <div className="container grid gap-8 py-10 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-sm font-bold text-white">
              س
            </span>
            <span className="text-lg font-bold">{name}</span>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {settings['site.description'] ?? 'خرید آنلاین شماره سیم‌کارت، مودم و کد فعال‌سازی با پرداخت امن.'}
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">دسترسی سریع</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">پشتیبانی</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {SUPPORT_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">تماس با ما</h3>
          {settings['site.phone'] ? (
            <p className="text-sm text-muted-foreground">
              تلفن:{' '}
              <a href={`tel:${settings['site.phone']}`} dir="ltr" className="hover:text-primary">
                {toPersianDigits(settings['site.phone'])}
              </a>
            </p>
          ) : null}
          {settings['site.email'] ? (
            <p className="text-sm text-muted-foreground" dir="ltr">
              {settings['site.email']}
            </p>
          ) : null}
          {settings['site.address'] ? (
            <p className="text-sm text-muted-foreground">{settings['site.address']}</p>
          ) : null}
          <div className="flex gap-3 pt-1 text-sm text-muted-foreground">
            {settings['site.instagram'] ? (
              <a href={settings['site.instagram']} className="hover:text-primary" rel="noreferrer noopener" target="_blank">
                اینستاگرام
              </a>
            ) : null}
            {settings['site.telegram'] ? (
              <a href={settings['site.telegram']} className="hover:text-primary" rel="noreferrer noopener" target="_blank">
                تلگرام
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t">
        <div className="container flex flex-col items-center justify-between gap-2 py-4 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {toPersianDigits(year)} تمامی حقوق برای {name} محفوظ است. آخرین به‌روزرسانی: {formatJalaliDate(new Date())}
          </p>
          <p>پرداخت امن از طریق درگاه‌های معتبر ایرانی</p>
        </div>
      </div>
    </footer>
  );
}
