import type { Metadata } from 'next';
import { ResellerRegisterForm } from '@/components/site/reseller-register-form';

export const metadata: Metadata = { title: 'ثبت‌نام نمایندگی' };
export const dynamic = 'force-dynamic';

export default function ResellerRegisterPage() {
  return (
    <div className="container max-w-3xl py-10">
      <header className="mb-6 space-y-2 text-center">
        <h1 className="text-2xl font-bold">ثبت‌نام نمایندگی</h1>
        <p className="text-sm text-muted-foreground">
          پس از ثبت اطلاعات، حساب شما توسط مدیر بررسی و تأیید می‌شود. سپس می‌توانید شماره و مودم خود را
          به‌صورت دستی یا گروهی (اکسل) ثبت کنید.
        </p>
      </header>
      <ResellerRegisterForm />
    </div>
  );
}
