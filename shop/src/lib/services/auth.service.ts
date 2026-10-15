import { prisma } from '../prisma';
import { badRequest, conflict, forbidden, unauthorized } from '../errors';
import { hashPassword, verifyPassword } from '../auth/password';
import { writeAudit } from '../audit';
import { normalizeMsisdn } from '../filters/operator-detect';
import { isValidIranianNationalId, isValidShaba } from '../validation/common';
import { buildResellerCode, nextSequence } from '../utils/ids';
import { getSettingNumber, getSettingBoolean } from '../settings';
import { buildOtpAuthUrl, buildQrDataUrl, generateTwoFactorSecret, verifyTwoFactorCode } from '../auth/totp';
import { isValidIranianMobile } from '../filters/operator-detect';

export interface RegisterCustomerInput {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  nationalId?: string;
}

async function roleIdFor(key: string): Promise<string | null> {
  const role = await prisma.role.findUnique({ where: { key } });
  return role?.id ?? null;
}

/** ثبت‌نام مشتری */
export async function registerCustomer(input: RegisterCustomerInput) {
  const phone = normalizeMsisdn(input.phone);
  if (!phone) throw badRequest('شماره موبایل معتبر نیست');
  if (input.nationalId && !isValidIranianNationalId(input.nationalId)) {
    throw badRequest('کد ملی معتبر نیست');
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) throw conflict('این شماره موبایل قبلاً ثبت‌نام کرده است');

  if (input.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email: input.email } });
    if (emailTaken) throw conflict('این ایمیل قبلاً ثبت شده است');
  }

  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      phone,
      email: input.email ?? null,
      nationalId: input.nationalId ?? null,
      passwordHash: await hashPassword(input.password),
      roleKey: 'CUSTOMER',
      roleId: await roleIdFor('CUSTOMER'),
      status: 'ACTIVE',
    },
    select: { id: true, fullName: true, phone: true, email: true, roleKey: true, tokenVersion: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: 'CUSTOMER',
    action: 'REGISTER',
    entity: 'User',
    entityId: user.id,
    after: { phone },
  });
  return user;
}

export interface RegisterResellerInput {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  nationalId: string;
  shopName: string;
  province?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  shaba?: string;
  cardNumber?: string;
  bankName?: string;
}

/** ثبت‌نام نماینده — نیازمند تأیید ادمین */
export async function registerReseller(input: RegisterResellerInput) {
  const phone = normalizeMsisdn(input.phone);
  if (!phone) throw badRequest('شماره موبایل معتبر نیست');
  if (!isValidIranianNationalId(input.nationalId)) throw badRequest('کد ملی معتبر نیست');
  if (input.shaba && !isValidShaba(input.shaba)) throw badRequest('شماره شبا معتبر نیست');

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) throw conflict('این شماره موبایل قبلاً ثبت شده است');

  const commissionRate = await getSettingNumber('shop.defaultCommission');

  const user = await prisma.$transaction(async (tx) => {
    const sequence = await nextSequence(tx, 'reseller');
    const created = await tx.user.create({
      data: {
        fullName: input.fullName,
        phone,
        email: input.email ?? null,
        nationalId: input.nationalId,
        passwordHash: await hashPassword(input.password),
        roleKey: 'RESELLER',
        roleId: await roleIdFor('RESELLER'),
        status: 'ACTIVE',
      },
    });
    await tx.resellerProfile.create({
      data: {
        userId: created.id,
        code: buildResellerCode(sequence),
        shopName: input.shopName,
        nationalId: input.nationalId,
        phone,
        province: input.province ?? null,
        city: input.city ?? null,
        address: input.address ?? null,
        postalCode: input.postalCode ?? null,
        shaba: input.shaba ?? null,
        cardNumber: input.cardNumber ?? null,
        bankName: input.bankName ?? null,
        holderName: input.fullName,
        commissionRate,
        status: 'PENDING_APPROVAL',
      },
    });
    return created;
  });

  await writeAudit({
    userId: user.id,
    actorRole: 'RESELLER',
    action: 'REGISTER_RESELLER',
    entity: 'User',
    entityId: user.id,
    after: { shopName: input.shopName },
  });
  return user;
}

export interface AuthenticateInput {
  identifier: string;
  password: string;
  ip?: string;
  userAgent?: string;
  expectedRoles?: string[];
}

export interface AuthenticateResult {
  user: {
    id: string;
    fullName: string;
    roleKey: string;
    tokenVersion: number;
    resellerId: string | null;
    twoFactorEnabled: boolean;
  };
  requiresTwoFactor: boolean;
}

/** ورود با نام کاربری/موبایل/ایمیل + محافظت در برابر حمله‌ی حدس رمز */
export async function authenticate(input: AuthenticateInput): Promise<AuthenticateResult> {
  const identifier = input.identifier.trim();
  const normalizedPhone = normalizeMsisdn(identifier);

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: identifier },
        { email: identifier },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
    },
    include: { resellerProfile: { select: { id: true, status: true } } },
  });

  await prisma.loginAttempt.create({
    data: { identifier, ip: input.ip ?? null, userAgent: input.userAgent ?? null, success: false },
  });

  if (!user) {
    throw unauthorized('نام کاربری یا رمز عبور نادرست است');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw forbidden(`حساب شما موقتاً قفل است. ${minutes} دقیقه دیگر تلاش کنید.`);
  }

  if (user.status === 'SUSPENDED') throw forbidden('حساب کاربری شما غیرفعال شده است');
  if (user.status === 'PENDING') throw forbidden('حساب کاربری شما در انتظار تأیید است');

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) {
    const maxAttempts = await getSettingNumber('security.maxLoginAttempts');
    const lockMinutes = await getSettingNumber('security.lockoutMinutes');
    const failedCount = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failedCount,
        lockedUntil:
          failedCount >= (maxAttempts || 5)
            ? new Date(Date.now() + (lockMinutes || 15) * 60_000)
            : null,
      },
    });
    await writeAudit({
      userId: user.id,
      action: 'LOGIN_FAILED',
      entity: 'User',
      entityId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    throw unauthorized('نام کاربری یا رمز عبور نادرست است');
  }

  if (input.expectedRoles?.length && !input.expectedRoles.includes(user.roleKey)) {
    throw forbidden('شما اجازه‌ی ورود از این بخش را ندارید');
  }

  // نماینده‌ی تأییدنشده اجازه‌ی ورود به پنل ندارد
  if (user.roleKey === 'RESELLER' && user.resellerProfile && user.resellerProfile.status !== 'APPROVED') {
    throw forbidden('حساب نمایندگی شما هنوز تأیید نشده است. با پشتیبانی تماس بگیرید.');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: input.ip ?? null,
    },
  });

  await prisma.loginAttempt.updateMany({
    where: { identifier, success: false, createdAt: { gte: new Date(Date.now() - 1000) } },
    data: { success: true, reason: 'ok' },
  });

  const requireTwoFactorGlobal = await getSettingBoolean('security.requireAdminTwoFactor');
  const isStaff = user.roleKey === 'ADMIN' || user.roleKey === 'SUPER_ADMIN';
  const requiresTwoFactor =
    (user.twoFactorEnabled || (isStaff && requireTwoFactorGlobal)) && Boolean(user.twoFactorSecret);

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      roleKey: user.roleKey,
      tokenVersion: user.tokenVersion,
      resellerId: user.resellerProfile?.id ?? null,
      twoFactorEnabled: user.twoFactorEnabled,
    },
    requiresTwoFactor,
  };
}

/** تأیید کد دو مرحله‌ای در زمان ورود */
export async function verifyLoginTwoFactor(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) return false;
  const ok = verifyTwoFactorCode(user.twoFactorSecret, code);
  await writeAudit({
    userId,
    action: ok ? '2FA_SUCCESS' : '2FA_FAILED',
    entity: 'User',
    entityId: userId,
  });
  return ok;
}

/** فعال‌سازی دو مرحله‌ای: ساخت راز و کد QR */
export async function startTwoFactorSetup(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized();
  const secret = generateTwoFactorSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret, twoFactorEnabled: false },
  });
  const otpauthUrl = buildOtpAuthUrl(secret, user.username ?? user.phone);
  return { secret, otpauthUrl, qrDataUrl: await buildQrDataUrl(otpauthUrl) };
}

export async function confirmTwoFactorSetup(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) throw badRequest('ابتدا فرآیند فعال‌سازی را شروع کنید');
  if (!verifyTwoFactorCode(user.twoFactorSecret, code)) {
    throw badRequest('کد وارد شده نادرست است');
  }
  await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
  await writeAudit({ userId, action: '2FA_ENABLED', entity: 'User', entityId: userId });
  return { enabled: true };
}

export async function disableTwoFactor(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.twoFactorSecret) throw badRequest('ورود دو مرحله‌ای فعال نیست');
  if (!verifyTwoFactorCode(user.twoFactorSecret, code)) throw badRequest('کد وارد شده نادرست است');
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  await writeAudit({ userId, action: '2FA_DISABLED', entity: 'User', entityId: userId });
  return { enabled: false };
}

/** تغییر رمز عبور + باطل‌کردن همه‌ی نشست‌های فعال */
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized();
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw badRequest('رمز عبور فعلی نادرست است');
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      tokenVersion: { increment: 1 }, // خروج از همه‌ی دستگاه‌ها
    },
  });
  await writeAudit({ userId, action: 'PASSWORD_CHANGE', entity: 'User', entityId: userId });
  return { changed: true };
}

export function assertValidMobile(input: string): string {
  if (!isValidIranianMobile(input)) throw badRequest('شماره موبایل معتبر نیست');
  return normalizeMsisdn(input)!;
}
