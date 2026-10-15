import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../prisma';
import { buildPhoneWhere } from '../filters/phone-filter';
import {
  detectOperatorCode,
  extractMiddle,
  extractPrefix,
  extractSuffix,
  normalizeMsisdn,
} from '../filters/operator-detect';
import { analyzeNumber } from '../utils/pattern';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { getSettingNumber } from '../settings';
import { writeAudit } from '../audit';
import type { PhoneFilterInput } from '../validation/product';

export interface Actor {
  userId: string;
  roleKey: string;
  permissions: string[];
  resellerId?: string | null;
}

export function isStaffActor(actor: Actor): boolean {
  return actor.roleKey === 'ADMIN' || actor.roleKey === 'SUPER_ADMIN';
}

/** شرط مخفی‌کردن محصولات نمایندگان غیرفعال از فروشگاه */
export const VISIBLE_OWNER_FILTER: Prisma.PhoneNumberWhereInput = {
  OR: [{ ownerType: 'PLATFORM' }, { reseller: { status: 'ACTIVE' } }],
};

/** جستجوی پیشرفته‌ی شماره‌ها (فروشگاه و پنل‌ها) */
export async function listPhones(
  filters: PhoneFilterInput,
  options: { forStorefront?: boolean; extraWhere?: Prisma.PhoneNumberWhereInput } = {},
) {
  const built = await buildPhoneWhere(filters, prisma as unknown as {
    $queryRaw: <T>(q: TemplateStringsArray, ...v: unknown[]) => Promise<T>;
  });

  const AND: Prisma.PhoneNumberWhereInput[] = [];
  if (built.where.AND) AND.push(...(built.where.AND as Prisma.PhoneNumberWhereInput[]));
  if (options.forStorefront) AND.push(VISIBLE_OWNER_FILTER);
  if (options.extraWhere) AND.push(options.extraWhere);

  const where: Prisma.PhoneNumberWhereInput = AND.length ? { AND } : {};

  const [items, total] = await Promise.all([
    prisma.phoneNumber.findMany({
      where,
      include: { operator: true },
      orderBy: built.orderBy,
      skip: (built.page - 1) * built.limit,
      take: built.limit,
    }),
    prisma.phoneNumber.count({ where }),
  ]);

  return { items, total, page: built.page, limit: built.limit };
}

export async function getPhoneById(id: string) {
  const phone = await prisma.phoneNumber.findUnique({
    where: { id },
    include: { operator: true, reseller: { include: { resellerProfile: true } } },
  });
  if (!phone || phone.deletedAt) throw notFound('شماره یافت نشد');
  return phone;
}

export async function incrementPhoneViews(id: string): Promise<void> {
  await prisma.phoneNumber
    .update({ where: { id }, data: { views: { increment: 1 } } })
    .catch(() => undefined);
}

async function resolveOperatorId(msisdn: string, operatorId?: string): Promise<string> {
  if (operatorId) {
    const op = await prisma.operator.findUnique({ where: { id: operatorId } });
    if (!op) throw badRequest('اپراتور انتخابی معتبر نیست');
    return op.id;
  }
  const code = detectOperatorCode(msisdn);
  const op = await prisma.operator.findUnique({ where: { code } });
  if (op) return op.id;
  const fallback = await prisma.operator.findUnique({ where: { code: 'OTHER' } });
  if (!fallback) {
    throw badRequest('اپراتور پیش‌فرض یافت نشد. ابتدا اپراتورها را ثبت کنید.');
  }
  return fallback.id;
}

export interface CreatePhoneInput {
  msisdn: string;
  price: bigint;
  description?: string;
  operatorId?: string;
}

/** ثبت شماره‌ی جدید (ادمین یا نماینده) */
export async function createPhone(input: CreatePhoneInput, actor: Actor) {
  const msisdn = normalizeMsisdn(input.msisdn);
  if (!msisdn) throw badRequest('شماره موبایل معتبر نیست');

  const existing = await prisma.phoneNumber.findUnique({ where: { msisdn } });
  if (existing && !existing.deletedAt) {
    throw conflict(`شماره‌ی ${msisdn} قبلاً ثبت شده است (وضعیت: ${existing.status})`);
  }

  const operatorId = await resolveOperatorId(msisdn, input.operatorId);
  const analysis = analyzeNumber(msisdn, await getSettingNumber('shop.rondThreshold'));
  const ownerType = isStaffActor(actor) ? 'PLATFORM' : 'RESELLER';
  if (ownerType === 'RESELLER' && !actor.resellerId) {
    throw forbidden('پروفایل نمایندگی شما کامل نیست');
  }

  const data = {
    msisdn,
    operatorId,
    prefix: extractPrefix(msisdn),
    suffix: extractSuffix(msisdn),
    middle: extractMiddle(msisdn),
    length: msisdn.length,
    price: input.price,
    description: input.description?.trim() || null,
    ownerType: ownerType as 'PLATFORM' | 'RESELLER',
    resellerId: ownerType === 'RESELLER' ? actor.resellerId! : null,
    isRond: analysis.isRond,
    isSequential: analysis.isSequential,
    isRepeated: analysis.isRepeated,
    isPalindrome: analysis.isPalindrome,
    rondScore: analysis.rondScore,
    status: 'AVAILABLE' as const,
  };

  // اگر شماره قبلاً حذف نرم شده باشد، بازیابی می‌شود
  const phone = existing?.deletedAt
    ? await prisma.phoneNumber.update({
        where: { id: existing.id },
        data: { ...data, deletedAt: null, soldAt: null, soldOrderId: null },
        include: { operator: true },
      })
    : await prisma.phoneNumber.create({ data, include: { operator: true } });

  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'CREATE',
    entity: 'PhoneNumber',
    entityId: phone.id,
    after: { msisdn, price: input.price.toString(), ownerType },
  });

  return phone;
}

export async function assertPhoneOwnership(
  phone: { resellerId: string | null; ownerType: string; status: string },
  actor: Actor,
) {
  if (
    phone.ownerType === 'RESELLER' &&
    phone.resellerId !== actor.resellerId &&
    !isStaffActor(actor)
  ) {
    throw forbidden('این شماره متعلق به شما نیست');
  }
  if (phone.status !== 'AVAILABLE' && !isStaffActor(actor)) {
    throw forbidden('فقط شماره‌های موجود قابل ویرایش یا حذف هستند');
  }
}

export async function updatePhone(
  id: string,
  input: { price?: bigint; description?: string; status?: 'AVAILABLE' | 'INACTIVE' },
  actor: Actor,
) {
  const phone = await prisma.phoneNumber.findUnique({ where: { id } });
  if (!phone || phone.deletedAt) throw notFound('شماره یافت نشد');
  await assertPhoneOwnership(phone, actor);

  const updated = await prisma.phoneNumber.update({
    where: { id },
    data: {
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    include: { operator: true },
  });

  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'UPDATE',
    entity: 'PhoneNumber',
    entityId: id,
    before: { price: phone.price.toString(), description: phone.description, status: phone.status },
    after: {
      price: updated.price.toString(),
      description: updated.description,
      status: updated.status,
    },
  });
  return updated;
}

/** حذف نرم — فقط برای شماره‌های فروخته‌نشده */
export async function softDeletePhone(id: string, actor: Actor) {
  const phone = await prisma.phoneNumber.findUnique({ where: { id } });
  if (!phone || phone.deletedAt) throw notFound('شماره یافت نشد');
  await assertPhoneOwnership(phone, actor);
  await prisma.phoneNumber.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'INACTIVE' },
  });
  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'DELETE',
    entity: 'PhoneNumber',
    entityId: id,
    before: { msisdn: phone.msisdn },
  });
}

/**
 * رزرو موقت شماره‌ها هنگام ورود به درگاه پرداخت.
 * به‌روزرسانی شرطی و اتمی است تا از فروش همزمان یک شماره جلوگیری شود.
 */
export async function reservePhoneNumbers(
  tx: Tx,
  phoneIds: string[],
  token: string,
  minutes: number,
): Promise<{ reserved: string[]; failed: string[] }> {
  const reservedUntil = new Date(Date.now() + minutes * 60_000);
  const reserved: string[] = [];
  const failed: string[] = [];

  for (const id of phoneIds) {
    const result = await tx.phoneNumber.updateMany({
      where: {
        id,
        deletedAt: null,
        OR: [
          { status: 'AVAILABLE' },
          { status: 'RESERVED', reservedUntil: { lt: new Date() } },
          { status: 'RESERVED', reservedByToken: token },
        ],
      },
      data: {
        status: 'RESERVED',
        reservedAt: new Date(),
        reservedUntil,
        reservedByToken: token,
      },
    });
    if (result.count === 1) reserved.push(id);
    else failed.push(id);
  }
  return { reserved, failed };
}

/** آزادسازی رزروهای منقضی‌شده */
export async function releaseExpiredReservations(): Promise<number> {
  const result = await prisma.phoneNumber.updateMany({
    where: { status: 'RESERVED', reservedUntil: { lt: new Date() }, soldOrderId: null },
    data: { status: 'AVAILABLE', reservedAt: null, reservedUntil: null, reservedByToken: null },
  });
  return result.count;
}

/** آمار خلاصه برای داشبورد */
export async function phoneStats(where: Prisma.PhoneNumberWhereInput) {
  const grouped = await prisma.phoneNumber.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
  });
  const counts = { AVAILABLE: 0, RESERVED: 0, SOLD: 0, INACTIVE: 0 };
  for (const row of grouped) counts[row.status] = row._count._all;
  const revenue = await prisma.phoneNumber.aggregate({
    where: { ...where, status: 'SOLD' },
    _sum: { price: true },
  });
  return { counts, revenue: revenue._sum.price ?? 0n };
}
