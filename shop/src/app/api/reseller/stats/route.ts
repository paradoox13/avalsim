import { ok, route } from '@/lib/api';
import { requireApprovedReseller } from '@/lib/guards';
import { phoneStats } from '@/lib/services/phone.service';
import { getResellerFinancials } from '@/lib/services/settlement.service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** آمار پنل نماینده: موجودی محصولات، فروش، مانده مالی */
export const GET = route(async () => {
  const { resellerId, userId } = await requireApprovedReseller();

  const [phones, modems, financials, recentOrders] = await Promise.all([
    phoneStats({ resellerId }),
    prisma.modem.groupBy({ by: ['isActive'], where: { resellerId, deletedAt: null }, _count: { _all: true } }),
    getResellerFinancials(resellerId),
    prisma.orderItem.findMany({
      where: { resellerId: userId },
      include: { order: { select: { orderNumber: true, status: true, paidAt: true, customerName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const modemTotal = modems.reduce((sum, m) => sum + m._count._all, 0);

  return ok({
    phones,
    modems: { total: modemTotal },
    financials: {
      balance: financials.balance,
      totalSales: financials.totalSales,
      totalCommission: financials.totalCommission,
      totalSettled: financials.totalSettled,
      pendingSettlementAmount: financials.pendingSettlementAmount,
      soldItemsCount: financials.soldItemsCount,
    },
    recentSales: recentOrders.map((item) => ({
      id: item.id,
      title: item.title,
      amount: item.totalPrice,
      commission: item.commissionAmount,
      orderNumber: item.order.orderNumber,
      buyerName: item.order.customerName,
      status: item.order.status,
      soldAt: item.order.paidAt,
    })),
  });
});
