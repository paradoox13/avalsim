import type { Metadata } from 'next';
import { ContentShell } from '@/components/site/content-shell';
import { Badge } from '@/components/ui/badge';
import { getPublicSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'درباره ما' };
export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const settings = await getPublicSettings().catch(() => ({}) as Record<string, string>);
  return (
    <ContentShell slug="about" title="درباره ما" subtitle={settings['site.tagline']}>
      <p>
        {settings['site.name'] ?? 'سیم‌شاپ'} با هدف ساده‌کردن خرید شماره سیم‌کارت، مودم و کد فعال‌سازی در
        ایران راه‌اندازی شده است. ما شماره‌ها را با اطلاعات کامل (اپراتور، قیمت، ویژگی‌های رند، متوالی و
        آینه) در اختیار شما قرار می‌دهیم تا با چند کلیک، شماره‌ی مناسب خود را پیدا کنید.
      </p>
      <h2 className="pt-2 text-base font-semibold">چرا ما؟</h2>
      <ul className="list-inside list-disc space-y-1 text-muted-foreground">
        <li>فیلترهای پیشرفته برای یافتن شماره‌های رند و خاص</li>
        <li>حذف خودکار شماره‌های فروخته‌شده از سایت (بدون فروش همزمان)</li>
        <li>پرداخت امن از طریق درگاه‌های بانکی معتبر ایران</li>
        <li>پنل اختصاصی نمایندگان با پشتیبانی از ثبت گروهی از طریق اکسل</li>
        <li>اطلاع‌رسانی پیامکی در تمام مراحل سفارش</li>
      </ul>
      <div className="flex flex-wrap gap-2 pt-2">
        <Badge variant="secondary">پرداخت امن</Badge>
        <Badge variant="secondary">پشتیبانی پیامکی</Badge>
        <Badge variant="secondary">نمایندگان سراسر کشور</Badge>
      </div>
    </ContentShell>
  );
}
