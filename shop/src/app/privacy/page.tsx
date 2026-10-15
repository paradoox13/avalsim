import type { Metadata } from 'next';
import { ContentShell } from '@/components/site/content-shell';

export const metadata: Metadata = { title: 'حریم خصوصی' };
export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  return (
    <ContentShell slug="privacy" title="حریم خصوصی" subtitle="ما چگونه از اطلاعات شما محافظت می‌کنیم">
      <h2 className="text-base font-semibold">اطلاعاتی که ذخیره می‌کنیم</h2>
      <ul className="list-inside list-disc space-y-1 text-muted-foreground">
        <li>اطلاعات هویتی لازم برای احراز و ثبت سفارش (نام، شماره موبایل، کد ملی، نشانی)</li>
        <li>اطلاعات سفارش‌ها و تراکنش‌های مالی برای پیگیری و حسابداری</li>
        <li>آدرس IP و اطلاعات مرورگر فقط برای امنیت و جلوگیری از سوءاستفاده</li>
      </ul>

      <h2 className="text-base font-semibold">چه کارهایی نمی‌کنیم</h2>
      <ul className="list-inside list-disc space-y-1 text-muted-foreground">
        <li>اطلاعات شما را به هیچ شخص یا شرکت ثالثی نمی‌فروشیم</li>
        <li>اطلاعات کارت بانکی شما هرگز در سرور ما ذخیره نمی‌شود؛ پرداخت کاملاً در درگاه بانکی انجام می‌شود</li>
        <li>رمز عبور شما به‌صورت متن ساده ذخیره نمی‌شود (الگوریتم bcrypt با هزینه‌ی بالا)</li>
      </ul>

      <h2 className="text-base font-semibold">امنیت</h2>
      <p className="text-muted-foreground">
        ارتباط شما با سایت از طریق HTTPS رمزنگاری می‌شود. دسترسی به اطلاعات در پنل مدیریت بر اساس نقش و
        سطح دسترسی کنترل می‌شود و تمام تغییرات مهم در «لاگ تغییرات» ثبت می‌گردد.
      </p>

      <h2 className="text-base font-semibold">حقوق شما</h2>
      <p className="text-muted-foreground">
        برای مشاهده، اصلاح یا حذف اطلاعات خود می‌توانید از طریق صفحه‌ی تماس با ما درخواست دهید. ما در
        کوتاه‌ترین زمان ممکن پاسخ خواهیم داد.
      </p>
    </ContentShell>
  );
}
