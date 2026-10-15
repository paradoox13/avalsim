import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/site/login-form';
import { getCurrentUser } from '@/lib/auth/session';
import { isStaff } from '@/lib/auth/rbac';

export const metadata: Metadata = { title: 'ورود مدیران', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user && isStaff(user.roleKey)) redirect('/admin');

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <LoginForm
        portal="admin"
        title="ورود پنل مدیریت"
        description="دسترسی فقط برای مدیران مجاز است"
      />
    </div>
  );
}
