import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isStaff } from '@/lib/auth/rbac';
import { DashboardShell, type DashboardNavGroup } from '@/components/dashboard/dashboard-shell';

export const dynamic = 'force-dynamic';

const NAV: DashboardNavGroup[] = [
  {
    title: 'نمای کلی',
    items: [{ href: '/admin', label: 'داشبورد آماری', icon: 'dashboard' }],
  },
  {
    title: 'فروش',
    items: [
      { href: '/admin/orders', label: 'سفارش‌ها', icon: 'orders', permission: 'orders.read' },
      { href: '/admin/reports', label: 'گزارش‌ها', icon: 'reports', permission: 'reports.read' },
    ],
  },
  {
    title: 'محصولات',
    items: [
      { href: '/admin/phones', label: 'شماره‌ها', icon: 'phone', permission: 'products.phones.read' },
      { href: '/admin/modems', label: 'مودم‌ها', icon: 'modem', permission: 'products.modems.read' },
      { href: '/admin/activation', label: 'قیمت کد فعال‌سازی', icon: 'activation', permission: 'products.activation.read' },
      { href: '/admin/import', label: 'ایمپورت اکسل', icon: 'import', permission: 'products.phones.write' },
    ],
  },
  {
    title: 'نمایندگان',
    items: [
      { href: '/admin/resellers', label: 'مدیریت نمایندگان', icon: 'users', permission: 'resellers.read' },
      { href: '/admin/settlements', label: 'تسویه‌ها', icon: 'settlements', permission: 'resellers.read' },
    ],
  },
  {
    title: 'سیستم',
    items: [
      { href: '/admin/sms', label: 'پیامک‌ها', icon: 'sms', permission: 'sms.read' },
      { href: '/admin/settings', label: 'تنظیمات', icon: 'settings', permission: 'settings.read' },
      { href: '/admin/users', label: 'کاربران و نقش‌ها', icon: 'users', permission: 'users.read' },
      { href: '/admin/audit', label: 'لاگ تغییرات', icon: 'audit', permission: 'audit.read' },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect('/admin/login');
  if (!isStaff(user.roleKey)) redirect('/');

  return (
    <DashboardShell
      title="پنل مدیریت"
      roleLabel={user.roleKey === 'SUPER_ADMIN' ? 'مدیر کل' : 'مدیر'}
      user={{ fullName: user.fullName, phone: user.phone }}
      groups={NAV}
      permissions={user.permissions}
    >
      {children}
    </DashboardShell>
  );
}
