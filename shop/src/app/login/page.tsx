import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LoginForm } from '@/components/site/login-form';
import { getCurrentUser } from '@/lib/auth/session';
import { homePathForRole } from '@/lib/auth/rbac';

export const metadata: Metadata = { title: 'ورود به حساب کاربری' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(homePathForRole(user.roleKey));

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <Suspense>
        <LoginForm
          portal="customer"
          title="ورود به حساب کاربری"
          description="برای پیگیری سفارش‌ها و خرید سریع‌تر وارد شوید"
          footer={
            <>
              حساب کاربری ندارید؟{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                ثبت‌نام کنید
              </Link>
            </>
          }
        />
      </Suspense>
    </div>
  );
}
