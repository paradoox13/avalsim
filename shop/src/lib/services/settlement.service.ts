import { prisma } from '../prisma';
import { badRequest, conflict, notFound } from '../errors';
import { writeAudit } from '../audit';
import { formatTomanCompact } from '../utils/money';
import { renderTemplate, SMS_TEMPLATES } from '../sms/templates';
import { sendSms } from './notification.service';
import { generateTrackingCode } from '../utils/ids';

/** مانده و آمار مالی یک نماینده */
export async function getResellerFinancials(resellerId: string) {
  const profile = await prisma.resellerProfile.findUnique({ where: { id: resellerId } });
  if (!profile) throw notFound('پروفایل نمایندگی یافت نشد');

  const [pendingSettlements, paidSettlements, soldItems] = await Promise.all([
    prisma.settlement.aggregate({
      where: { resellerId, status: { in: ['PENDING', 'APPROVED'] } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.settlement.aggregate({
      where: { resellerId, status: 'PAID' },
      _sum: { amount: true },
    }),
    prisma.orderItem.aggregate({
      where: { resellerId, order: { status: { in: ['PAID', 'PROCESSING', 'AWAITING_PHYSICAL_DELIVERY', 'SHIPPED', 'DELIVERED'] } } },
      _count: { _all: true },
      _sum: { totalPrice: true, commissionAmount: true },
    }),
  ]);

  return {
    profile,
    balance: profile.balance,
    totalSales: profile.totalSales,
    totalCommission: profile.totalCommission,
    totalSettled: profile.totalSettled,
    pendingSettlementAmount: pendingSettlements._sum.amount ?? 0n,
    pendingSettlementCount: pendingSettlements._count._all,
    paidSettlementAmount: paidSettlements._sum.amount ?? 0n,
    soldItemsCount: soldItems._count._all,
    soldItemsAmount: soldItems._sum.totalPrice ?? 0n,
    soldCommission: soldItems._sum.commissionAmount ?? 0n,
  };
}

export interface CreateSettlementInput {
  resellerId: string;
  amount?: bigint;
  periodStart?: Date;
  periodEnd?: Date;
  note?: string;
}

/**
 * ثبت درخواست تسویه.
 * اگر مبلغ مشخص نشود، کل مانده‌ی قابل تسویه استفاده می‌شود.
 */
export async function createSettlement(input: CreateSettlementInput, actor: { userId: string; roleKey: string }) {
  const profile = await prisma.resellerProfile.findUnique({
    where: { id: input.resellerId },
    include: { user: { select: { phone: true, fullName: true } } },
  });
  if (!profile) throw notFound('پروفایل نمایندگی یافت نشد');

  const amount = input.amount ?? profile.balance;
  if (amount <= 0n) throw badRequest('مبلغ تسویه باید بزرگ‌تر از صفر باشد');
  if (amount > profile.balance) {
    throw badRequest(`مبلغ تسویه بیشتر از مانده قابل پرداخت است (${formatTomanCompact(profile.balance)})`);
  }

  const settlement = await prisma.$transaction(async (tx) => {
    const created = await tx.settlement.create({
      data: {
        resellerId: input.resellerId,
        amount,
        status: 'PENDING',
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        note: input.note ?? null,
        createdById: actor.userId,
      },
    });
    // مانده بلافاصله کسر می‌شود تا امکان تسویه‌ی مضاعف از بین برود
    await tx.resellerProfile.update({
      where: { id: input.resellerId },
      data: { balance: { decrement: amount } },
    });
    return created;
  });

  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'CREATE',
    entity: 'Settlement',
    entityId: settlement.id,
    after: { resellerId: input.resellerId, amount: amount.toString() },
  });
  return settlement;
}

/** ثبت پرداخت تسویه به نماینده */
export async function markSettlementPaid(
  settlementId: string,
  input: { trackingCode?: string; note?: string },
  actor: { userId: string; roleKey: string },
) {
  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: { reseller: { include: { user: { select: { phone: true } } } } },
  });
  if (!settlement) throw notFound('تسویه یافت نشد');
  if (settlement.status === 'PAID') throw conflict('این تسویه قبلاً پرداخت شده است');
  if (settlement.status === 'REJECTED') throw conflict('این تسویه رد شده است');

  const trackingCode = input.trackingCode || generateTrackingCode();

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.settlement.update({
      where: { id: settlementId },
      data: { status: 'PAID', paidAt: new Date(), trackingCode, note: input.note ?? settlement.note },
    });
    await tx.resellerProfile.update({
      where: { id: settlement.resellerId },
      data: { totalSettled: { increment: settlement.amount } },
    });
    return result;
  });

  await sendSms({
    mobile: settlement.reseller.user.phone,
    userId: settlement.reseller.userId,
    message: renderTemplate(SMS_TEMPLATES.resellerSettlement, {
      amount: formatTomanCompact(settlement.amount),
      code: trackingCode,
    }),
    label: 'settlement',
  });

  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'SETTLE',
    entity: 'Settlement',
    entityId: settlementId,
    after: { amount: settlement.amount.toString(), trackingCode },
  });
  return updated;
}

/** رد تسویه و بازگرداندن مبلغ به مانده */
export async function rejectSettlement(
  settlementId: string,
  note: string,
  actor: { userId: string; roleKey: string },
) {
  const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
  if (!settlement) throw notFound('تسویه یافت نشد');
  if (settlement.status === 'PAID') throw conflict('تسویه پرداخت‌شده قابل رد نیست');

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.settlement.update({
      where: { id: settlementId },
      data: { status: 'REJECTED', note },
    });
    await tx.resellerProfile.update({
      where: { id: settlement.resellerId },
      data: { balance: { increment: settlement.amount } },
    });
    return result;
  });

  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'REJECT_SETTLEMENT',
    entity: 'Settlement',
    entityId: settlementId,
    after: { note },
  });
  return updated;
}

export async function listSettlements(filter: {
  resellerId?: string;
  status?: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  page?: number;
  limit?: number;
}) {
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 20;
  const where = {
    ...(filter.resellerId ? { resellerId: filter.resellerId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      include: { reseller: { include: { user: { select: { fullName: true, phone: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.settlement.count({ where }),
  ]);
  return { items, total, page, limit };
}
