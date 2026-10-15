import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { ContactForm } from '@/components/site/contact-form';
import { getPublicSettings } from '@/lib/settings';
import { toPersianDigits } from '@/lib/utils/persian';
import { Mail, MapPin, Phone } from 'lucide-react';

export const metadata: Metadata = { title: 'تماس با ما' };
export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const settings = await getPublicSettings().catch(() => ({}) as Record<string, string>);

  return (
    <div className="container grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">تماس با ما</h1>
          <p className="text-sm text-muted-foreground">
            سوال، پیشنهاد یا مشکلی دارید؟ فرم زیر را پر کنید؛ در اسرع وقت پاسخ می‌دهیم.
          </p>
        </header>
        <ContactForm />
      </section>

      <aside className="space-y-4">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">راه‌های ارتباطی</h2>
          {settings['site.phone'] ? (
            <p className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-primary" aria-hidden />
              <a href={`tel:${settings['site.phone']}`} dir="ltr" className="hover:text-primary">
                {toPersianDigits(settings['site.phone'])}
              </a>
            </p>
          ) : null}
          {settings['site.email'] ? (
            <p className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-primary" aria-hidden />
              <a href={`mailto:${settings['site.email']}`} dir="ltr" className="hover:text-primary">
                {settings['site.email']}
              </a>
            </p>
          ) : null}
          {settings['site.address'] ? (
            <p className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
              {settings['site.address']}
            </p>
          ) : null}
        </Card>

        <Card className="space-y-2 p-5 text-sm text-muted-foreground">
          <h2 className="font-semibold text-foreground">ساعات پاسخ‌گویی</h2>
          <p>شنبه تا چهارشنبه: ۹ تا ۱۷</p>
          <p>پنجشنبه: ۹ تا ۱۳</p>
          <p className="pt-2 text-xs">
            برای پیگیری سریع سفارش، کد رهگیری خود را در صفحه‌ی «پیگیری سفارش» وارد کنید.
          </p>
        </Card>
      </aside>
    </div>
  );
}
