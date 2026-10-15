import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { getPublicSettings } from '@/lib/settings';

const vazirmatn = localFont({
  src: [
    { path: '../../public/fonts/Vazirmatn-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Vazirmatn-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-vazirmatn',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  let name = 'سیم‌شاپ';
  let description = 'خرید آنلاین شماره سیم‌کارت، مودم و کد فعال‌سازی';
  try {
    const settings = await getPublicSettings();
    name = settings['site.name'] ?? name;
    description = settings['site.description'] ?? description;
  } catch {
    /* در زمان بیلد ممکن است دیتابیس در دسترس نباشد */
  }
  return {
    title: { default: `${name} | خرید شماره سیم‌کارت و مودم`, template: `%s | ${name}` },
    description,
    keywords: ['خرید شماره سیم‌کارت', 'شماره رند', 'مودم', 'کد فعال‌سازی', 'همراه اول', 'ایرانسل'],
    openGraph: { title: name, description, locale: 'fa_IR', type: 'website' },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning className={vazirmatn.variable}>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          {/* لینک پرش به محتوا برای دسترسی‌پذیری */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            پرش به محتوای اصلی
          </a>
          <SiteHeader />
          <main id="main" className="min-h-[60vh]">
            {children}
          </main>
          <SiteFooter />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
