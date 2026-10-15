import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/site/login-form';
import { getCurrentUser } from '@/lib/auth/session';
import { homePathForRole } from '@/lib/auth/rbac';

export const metadata: Metadata = { title: 'ورود نمایندگان' };
export const dynamic = 'force-dynamic';

export default async function ResellerLoginPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user?.roleKey === 'RESELLER') redirect('/reseller');

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <LoginForm
        portal="reseller"
        title="ورود پنل نمایندگان"
        description="با نام کاربری و رمز عبور خود وارد شوید"
        footer={
          <>
            نماینده نیستید؟{' '}
            <Link href="/reseller/register" className="font-medium text-primary hover:underline">
              ثبت‌نام نمایندگی
            </Link>
          </>
        }
      />
    </div>
  );
}
