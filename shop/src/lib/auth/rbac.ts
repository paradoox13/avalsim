/**
 * کنترل دسترسی مبتنی بر نقش (RBAC) — منطق خالص و قابل تست.
 * کلیدهای دسترسی در قالب «منبع.عملیات» تعریف می‌شوند.
 */

export const ROLE_KEYS = {
  CUSTOMER: 'CUSTOMER',
  RESELLER: 'RESELLER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

export const PERMISSION_CATALOG: PermissionDef[] = [
  { key: 'dashboard.view', label: 'مشاهده داشبورد', group: 'عمومی' },

  { key: 'products.phones.read', label: 'مشاهده شماره‌ها', group: 'محصولات' },
  { key: 'products.phones.write', label: 'افزودن/ویرایش شماره', group: 'محصولات' },
  { key: 'products.phones.delete', label: 'حذف شماره', group: 'محصولات' },
  { key: 'products.modems.read', label: 'مشاهده مودم‌ها', group: 'محصولات' },
  { key: 'products.modems.write', label: 'افزودن/ویرایش مودم', group: 'محصولات' },
  { key: 'products.modems.delete', label: 'حذف مودم', group: 'محصولات' },
  { key: 'products.activation.read', label: 'مشاهده قیمت کد فعال‌سازی', group: 'محصولات' },
  { key: 'products.activation.write', label: 'ویرایش قیمت کد فعال‌سازی', group: 'محصولات' },

  { key: 'orders.read', label: 'مشاهده سفارش‌ها', group: 'سفارش‌ها' },
  { key: 'orders.write', label: 'تغییر وضعیت سفارش', group: 'سفارش‌ها' },
  { key: 'orders.refund', label: 'لغو/مرجوعی سفارش', group: 'سفارش‌ها' },

  { key: 'resellers.read', label: 'مشاهده نمایندگان', group: 'نمایندگان' },
  { key: 'resellers.write', label: 'ویرایش نمایندگان', group: 'نمایندگان' },
  { key: 'resellers.approve', label: 'تأیید نمایندگان', group: 'نمایندگان' },
  { key: 'resellers.settle', label: 'تسویه با نمایندگان', group: 'نمایندگان' },

  { key: 'reports.read', label: 'مشاهده گزارش‌ها', group: 'گزارش‌ها' },
  { key: 'reports.export', label: 'خروجی اکسل گزارش‌ها', group: 'گزارش‌ها' },

  { key: 'sms.read', label: 'مشاهده پیامک‌ها', group: 'پیامک' },
  { key: 'sms.send', label: 'ارسال پیامک دستی', group: 'پیامک' },

  { key: 'payments.configure', label: 'تنظیم درگاه پرداخت', group: 'مالی' },
  { key: 'settings.read', label: 'مشاهده تنظیمات', group: 'تنظیمات' },
  { key: 'settings.write', label: 'ویرایش تنظیمات', group: 'تنظیمات' },
  { key: 'users.read', label: 'مشاهده کاربران', group: 'کاربران' },
  { key: 'users.write', label: 'مدیریت کاربران', group: 'کاربران' },
  { key: 'roles.write', label: 'مدیریت نقش‌ها و دسترسی‌ها', group: 'کاربران' },
  { key: 'audit.read', label: 'مشاهده لاگ تغییرات', group: 'امنیت' },
  { key: 'content.write', label: 'مدیریت صفحات محتوایی', group: 'محتوا' },
];

export const ALL_PERMISSIONS = PERMISSION_CATALOG.map((p) => p.key);

/** دسترسی‌های پیش‌فرض هر نقش */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, string[]> = {
  CUSTOMER: [],
  RESELLER: [
    'dashboard.view',
    'products.phones.read',
    'products.phones.write',
    'products.phones.delete',
    'products.modems.read',
    'products.modems.write',
    'products.modems.delete',
    'orders.read',
    'reports.read',
  ],
  ADMIN: [
    'dashboard.view',
    'products.phones.read',
    'products.phones.write',
    'products.phones.delete',
    'products.modems.read',
    'products.modems.write',
    'products.modems.delete',
    'products.activation.read',
    'products.activation.write',
    'orders.read',
    'orders.write',
    'resellers.read',
    'resellers.write',
    'resellers.approve',
    'resellers.settle',
    'reports.read',
    'reports.export',
    'sms.read',
    'sms.send',
    'settings.read',
    'users.read',
    'audit.read',
    'content.write',
  ],
  SUPER_ADMIN: [...ALL_PERMISSIONS],
};

export interface AuthzUser {
  id: string;
  roleKey: string;
  permissions: string[];
  resellerId?: string | null;
}

export function can(user: Pick<AuthzUser, 'roleKey' | 'permissions'> | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.roleKey === ROLE_KEYS.SUPER_ADMIN) return true;
  return user.permissions.includes(permission);
}

export function canAny(user: Pick<AuthzUser, 'roleKey' | 'permissions'> | null | undefined, permissions: string[]): boolean {
  return permissions.some((p) => can(user, p));
}

export function isStaff(roleKey: string | undefined | null): boolean {
  return roleKey === ROLE_KEYS.ADMIN || roleKey === ROLE_KEYS.SUPER_ADMIN;
}

export function isReseller(roleKey: string | undefined | null): boolean {
  return roleKey === ROLE_KEYS.RESELLER;
}

/** مسیر پیش‌فرض هر نقش پس از ورود */
export function homePathForRole(roleKey: string | undefined | null): string {
  switch (roleKey) {
    case ROLE_KEYS.SUPER_ADMIN:
    case ROLE_KEYS.ADMIN:
      return '/admin';
    case ROLE_KEYS.RESELLER:
      return '/reseller';
    default:
      return '/';
  }
}
