import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  can,
  canAny,
  DEFAULT_ROLE_PERMISSIONS,
  homePathForRole,
  isReseller,
  isStaff,
  PERMISSION_CATALOG,
} from '@/lib/auth/rbac';

const admin = { roleKey: 'ADMIN', permissions: DEFAULT_ROLE_PERMISSIONS.ADMIN };
const reseller = { roleKey: 'RESELLER', permissions: DEFAULT_ROLE_PERMISSIONS.RESELLER };
const customer = { roleKey: 'CUSTOMER', permissions: [] };
const superAdmin = { roleKey: 'SUPER_ADMIN', permissions: [] };

describe('کنترل دسترسی نقش‌ها', () => {
  it('مدیر کل به همه چیز دسترسی دارد', () => {
    expect(can(superAdmin, 'roles.write')).toBe(true);
    expect(can(superAdmin, 'settings.write')).toBe(true);
  });

  it('مدیر دسترسی مدیریتی دارد اما نقش‌ها را نه', () => {
    expect(can(admin, 'products.phones.write')).toBe(true);
    expect(can(admin, 'orders.write')).toBe(true);
    expect(can(admin, 'audit.read')).toBe(true);
    expect(can(admin, 'roles.write')).toBe(false);
    expect(can(admin, 'settings.write')).toBe(false);
  });

  it('نماینده فقط به محصولات خودش دسترسی دارد', () => {
    expect(can(reseller, 'products.phones.write')).toBe(true);
    expect(can(reseller, 'products.modems.write')).toBe(true);
    expect(can(reseller, 'orders.read')).toBe(true);
    expect(can(reseller, 'resellers.settle')).toBe(false);
    expect(can(reseller, 'settings.write')).toBe(false);
  });

  it('مشتری هیچ دسترسی مدیریتی ندارد', () => {
    expect(can(customer, 'dashboard.view')).toBe(false);
    expect(canAny(customer, ['orders.read', 'products.phones.read'])).toBe(false);
  });

  it('کاربر null دسترسی ندارد', () => {
    expect(can(null, 'dashboard.view')).toBe(false);
    expect(can(undefined, 'dashboard.view')).toBe(false);
  });

  it('تشخیص کارکنان و نمایندگان', () => {
    expect(isStaff('ADMIN')).toBe(true);
    expect(isStaff('SUPER_ADMIN')).toBe(true);
    expect(isStaff('RESELLER')).toBe(false);
    expect(isReseller('RESELLER')).toBe(true);
  });

  it('مسیر پیش‌فرض هر نقش', () => {
    expect(homePathForRole('ADMIN')).toBe('/admin');
    expect(homePathForRole('SUPER_ADMIN')).toBe('/admin');
    expect(homePathForRole('RESELLER')).toBe('/reseller');
    expect(homePathForRole('CUSTOMER')).toBe('/');
  });

  it('همه‌ی دسترسی‌های پیش‌فرض در فهرست دسترسی‌ها وجود دارند', () => {
    for (const permissions of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(ALL_PERMISSIONS).toContain(permission);
      }
    }
  });

  it('کلید دسترسی‌ها تکراری نیست', () => {
    const keys = PERMISSION_CATALOG.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
