import { cookies } from 'next/headers';
import { prisma } from '../prisma';
import { unauthorized, forbidden } from '../errors';
import {
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession,
  type SessionClaims,
} from './jwt';
import { ROLE_KEYS, isStaff, type AuthzUser } from './rbac';

export const SESSION_COOKIE = 'simshop_session';
export const CSRF_COOKIE = 'simshop_csrf';
export const CART_COOKIE = 'simshop_cart';

export interface AuthUser extends AuthzUser {
  username: string | null;
  email: string | null;
  phone: string;
  fullName: string;
  status: string;
  twoFactorEnabled: boolean;
}

const isProd = process.env.NODE_ENV === 'production';

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function setSessionCookie(token: string, maxAge = SESSION_MAX_AGE_SECONDS): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(maxAge));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}

export async function getSessionPayload(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * کاربر جاری را از دیتابیس بارگذاری می‌کند.
 * tokenVersion بررسی می‌شود تا با تغییر رمز یا خروج از همه دستگاه‌ها، توکن‌ها باطل شوند.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const payload = await getSessionPayload();
  if (!payload || payload.roleKey === 'PENDING_2FA') return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      resellerProfile: { select: { id: true, status: true } },
    },
  });
  if (!user) return null;
  if (user.status !== 'ACTIVE') return null;
  if (user.tokenVersion !== payload.ver) return null;

  const permissions = user.role?.permissions.map((rp) => rp.permission.key) ?? [];
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    status: user.status,
    roleKey: user.roleKey,
    twoFactorEnabled: user.twoFactorEnabled,
    permissions,
    resellerId: user.resellerProfile?.id ?? null,
  };
}

export async function createSessionForUser(user: {
  id: string;
  roleKey: string;
  tokenVersion: number;
  resellerId?: string | null;
  twoFactorVerified?: boolean;
}): Promise<string> {
  return signSession({
    sub: user.id,
    roleKey: user.roleKey,
    ver: user.tokenVersion,
    rid: user.resellerId ?? undefined,
    tfa: user.twoFactorVerified ?? true,
  });
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireStaff(): Promise<AuthUser> {
  const user = await requireUser();
  if (!isStaff(user.roleKey)) throw forbidden('این بخش مخصوص مدیران است');
  return user;
}

export async function requireReseller(): Promise<AuthUser & { resellerId: string }> {
  const user = await requireUser();
  if (user.roleKey !== ROLE_KEYS.RESELLER || !user.resellerId) {
    throw forbidden('این بخش مخصوص نمایندگان است');
  }
  return user as AuthUser & { resellerId: string };
}
