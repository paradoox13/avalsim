import type { Metadata } from 'next';
import { ContentShell } from '@/components/site/content-shell';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export const metadata: Metadata = { title: 'سوالات متداول' };
export const dynamic = 'force-dynamic';

const FAQS = [
  {
    q: 'پس از خرید شماره سیم‌کارت چه اتفاقی می‌افتد؟',
    a: 'بلافاصله پس از تأیید پرداخت، شماره از فهرست سایت حذف و وضعیت آن «فروخته‌شده» ثبت می‌شود. کارشناسان ما برای تعیین زمان تحویل با شما تماس می‌گیرند.',
  },
  {
    q: 'اگر پرداخت ناموفق باشد، شماره‌ی رزروشده چه می‌شود؟',
    a: 'هنگام ورود به درگاه، شماره به‌صورت موقت (۱۵ دقیقه) رزرو می‌شود. در صورت ناموفق‌بودن پرداخت، رزرو خودکار آزاد و شماره دوباره قابل خرید می‌شود.',
  },
  {
    q: 'کد فعال‌سازی چگونه ارسال می‌شود؟',
    a: 'پس از پرداخت موفق، سفارش شما با وضعیت «در انتظار ارسال فیزیکی» ثبت و به مدیر اطلاع داده می‌شود. کد فعال‌سازی پس از آماده‌سازی برای شما ارسال می‌گردد.',
  },
  {
    q: 'شرایط نمایندگی چیست؟',
    a: 'برای نمایندگی کافی است فرم ثبت‌نام نمایندگی را تکمیل کنید. پس از تأیید مدیر، امکان ثبت دستی و گروهی شماره و مودم، مشاهده‌ی گزارش فروش و درخواست تسویه را خواهید داشت.',
  },
  {
    q: 'قیمت کد فعال‌سازی چگونه محاسبه می‌شود؟',
    a: 'قیمت کد فعال‌سازی پله‌ای است؛ با افزایش تعداد، قیمت هر عدد کاهش می‌یابد. قیمت نهایی به‌صورت خودکار در صفحه‌ی خرید محاسبه می‌شود.',
  },
  {
    q: 'امکان مرجوعی وجود دارد؟',
    a: 'شماره‌های سیم‌کارت پس از ثبت به نام خریدار قابل بازگشت نیستند. برای مودم‌ها، در صورت سالم‌بودن کالا و بسته‌بندی، تا ۷ روز امکان مرجوعی وجود دارد.',
  },
];

export default function FaqPage() {
  return (
    <ContentShell slug="faq" title="سوالات متداول" subtitle="پاسخ پرتکرارترین پرسش‌های کاربران">
      <Accordion type="single" collapsible className="w-full">
        {FAQS.map((faq, index) => (
          <AccordionItem key={faq.q} value={`item-${index}`}>
            <AccordionTrigger>{faq.q}</AccordionTrigger>
            <AccordionContent>{faq.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </ContentShell>
  );
}
