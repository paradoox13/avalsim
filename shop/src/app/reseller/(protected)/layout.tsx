import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { DashboardShell, type DashboardNavGroup } from '@/components/dashboard/dashboard-shell';

export const dynamic = 'force-dynamic';

const NAV: DashboardNavGroup[] = [
  {
    title: 'نمایندگی',
    items: [
      { href: '/reseller', label: 'داشبورد', icon: 'dashboard' },
      { href: '/reseller/phones', label: 'شماره‌های من', icon: 'phone' },
      { href: '/reseller/modems', label: 'مودم‌های من', icon: 'modem' },
      { href: '/reseller/import', label: 'ایمپورت اکسل', icon: 'import' },
    ],
  },
  {
    title: 'مالی',
    items: [
      { href: '/reseller/reports', label: 'گزارش فروش', icon: 'reports' },
      { href: '/reseller/settlements', label: 'تسویه‌ها', icon: 'settlements' },
    ],
  },
];

export default async function ResellerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect('/reseller/login');
  if (user.roleKey !== 'RESELLER') redirect('/');

  const profile = await prisma.resellerProfile
    .findUnique({ where: { userId: user.id }, select: { status: true, code: true, shopName: true } })
    .catch(() => null);

  if (!profile) redirect('/reseller/register');
  if (profile.status !== 'APPROVED') {
    return (
      <div className="container flex min-h-[70vh] items-center justify-center py-10 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-bold">حساب نمایندگی شما در انتظار تأیید است</h1>
          <p className="text-sm text-muted-foreground">
            کد نمایندگی: <strong dir="ltr">{profile.code}</strong>
            <br />
            پس از تأیید مدیر، پنل شما فعال می‌شود.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell
      title="پنل نمایندگان"
      roleLabel={`نماینده ${profile.code}`}
      user={{ fullName: user.fullName, phone: user.phone }}
      groups={NAV}
      permissions={user.permissions}
    >
      {children}
    </DashboardShell>
  );
}
