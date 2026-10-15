import { getCurrentUser, requireUser, type AuthUser } from './auth/session';
import { forbidden, unauthorized } from './errors';
import { can, isStaff, isReseller, ROLE_KEYS } from './auth/rbac';

/** کاربر واردشده با بررسی یک دسترسی مشخص */
export async function requirePermission(permission: string): Promise<AuthUser> {
  const user = await requireUser();
  if (!can(user, permission)) throw forbidden('دسترسی لازم برای این عملیات را ندارید');
  return user;
}

/** کاربر واردشده‌ی ادمین برای کوئری‌های فقط-خواندنی */
export async function requireStaffUser(requiredPermission?: string): Promise<AuthUser> {
  const user = await requireUser();
  if (!isStaff(user.roleKey)) throw forbidden('این بخش مخصوص مدیران است');
  if (requiredPermission && !can(user, requiredPermission)) throw forbidden('دسترسی لازم را ندارید');
  return user;
}

export interface ResellerContext {
  user: AuthUser;
  resellerId: string;
  userId: string;
}

/** نماینده‌ی تأییدشده همراه با شناسه‌ی پروفایل */
export async function requireApprovedReseller(): Promise<ResellerContext> {
  const user = await requireUser();
  if (!isReseller(user.roleKey)) throw forbidden('این بخش مخصوص نمایندگان است');

  const { prisma } = await import('./prisma');
  const profile = await prisma.resellerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw unauthorized('پروفایل نمایندگی یافت نشد');
  if (profile.status !== 'APPROVED') {
    throw forbidden('حساب نمایندگی شما تأیید نشده است');
  }
  return { user, resellerId: profile.id, userId: user.id };
}

/** دسترسی به پنل ادمین: ادمین یا مدیر کل */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (user.roleKey !== ROLE_KEYS.ADMIN && user.roleKey !== ROLE_KEYS.SUPER_ADMIN) {
    throw forbidden();
  }
  return user;
}
