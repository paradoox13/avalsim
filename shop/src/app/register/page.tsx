import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/site/register-form';
import { getCurrentUser } from '@/lib/auth/session';
import { homePathForRole } from '@/lib/auth/rbac';

export const metadata: Metadata = { title: 'ثبت‌نام' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(homePathForRole(user.roleKey));

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <RegisterForm />
    </div>
  );
}
