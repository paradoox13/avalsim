import { prisma } from '../prisma';
import { formatToman } from '../utils/money';
import { formatJalaliDateTime } from '../utils/jalali';
import { ORDER_STATUS_LABELS } from '../sms/templates';

const PAID_STATUSES = [
  'PAID',
  'PROCESSING',
  'AWAITING_PHYSICAL_DELIVERY',
  'SHIPPED',
  'DELIVERED',
] as const;

export interface DashboardStats {
  sales: { total: bigint; count: number; today: bigint; month: bigint };
  orders: Record<string, number>;
  phones: { available: number; reserved: number; sold: number };
  modems: { count: number; lowStock: number; outOfStock: number };
  resellers: { approved: number; pending: number; suspended: number };
  customers: number;
  sms: { sent: number; failed: number };
  series: Array<{ day: string; orders: number; total: bigint }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    total: bigint;
    status: string;
    createdAt: Date;
  }>;
}

/** آمار داشبورد ادمین */
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfSeries = new Date(startOfToday.getTime() - 13 * 86_400_000);

  const [
    salesAgg,
    todayAgg,
    monthAgg,
    orderGroups,
    phoneGroups,
    modemGroups,
    modemLow,
    resellerGroups,
    customers,
    smsGroups,
    seriesRows,
    recentOrders,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { status: { in: [...PAID_STATUSES] } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { status: { in: [...PAID_STATUSES] }, paidAt: { gte: startOfToday } }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { status: { in: [...PAID_STATUSES] }, paidAt: { gte: startOfMonth } }, _sum: { total: true } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.phoneNumber.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.modem.groupBy({ by: ['ownerType'], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.modem.count({ where: { deletedAt: null, stock: { lte: 2 } } }),
    prisma.resellerProfile.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.count({ where: { roleKey: 'CUSTOMER' } }),
    prisma.smsLog.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.$queryRaw<Array<{ day: Date; orders: number; total: string }>>`
      SELECT date_trunc('day', "paidAt") AS day,
             COUNT(*)::int AS orders,
             COALESCE(SUM(total), 0)::text AS total
      FROM "Order"
      WHERE status = ANY(${[...PAID_STATUSES]}::"OrderStatus"[])
        AND "paidAt" >= ${startOfSeries}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, orderNumber: true, customerName: true, total: true, status: true, createdAt: true },
    }),
  ]);

  const orders: Record<string, number> = {};
  for (const group of orderGroups) orders[group.status] = group._count._all;

  const phones = { available: 0, reserved: 0, sold: 0 };
  for (const group of phoneGroups) {
    if (group.status === 'AVAILABLE') phones.available = group._count._all;
    if (group.status === 'RESERVED') phones.reserved = group._count._all;
    if (group.status === 'SOLD') phones.sold = group._count._all;
  }

  const modemTotal = modemGroups.reduce((sum, g) => sum + g._count._all, 0);
  const outOfStock = await prisma.modem.count({ where: { deletedAt: null, stock: { lte: 0 } } });

  const resellers = { approved: 0, pending: 0, suspended: 0 };
  for (const group of resellerGroups) {
    if (group.status === 'APPROVED') resellers.approved = group._count._all;
    if (group.status === 'PENDING_APPROVAL') resellers.pending = group._count._all;
    if (group.status === 'SUSPENDED') resellers.suspended = group._count._all;
  }

  const sms = { sent: 0, failed: 0 };
  for (const group of smsGroups) {
    if (group.status === 'SENT' || group.status === 'DELIVERED') sms.sent += group._count._all;
    if (group.status === 'FAILED') sms.failed += group._count._all;
  }

  // پرکردن روزهای بدون فروش برای نمودار
  const seriesMap = new Map(seriesRows.map((r) => [new Date(r.day).toISOString().slice(0, 10), r]));
  const series: DashboardStats['series'] = [];
  for (let i = 0; i < 14; i += 1) {
    const day = new Date(startOfSeries.getTime() + i * 86_400_000);
    const key = day.toISOString().slice(0, 10);
    const row = seriesMap.get(key);
    series.push({
      day: key,
      orders: row?.orders ?? 0,
      total: row ? BigInt(row.total) : 0n,
    });
  }

  return {
    sales: {
      total: salesAgg._sum.total ?? 0n,
      count: salesAgg._count._all,
      today: todayAgg._sum.total ?? 0n,
      month: monthAgg._sum.total ?? 0n,
    },
    orders,
    phones,
    modems: { count: modemTotal, lowStock: modemLow, outOfStock },
    resellers,
    customers,
    sms,
    series,
    recentOrders,
  };
}

export interface ReportRange {
  from?: Date;
  to?: Date;
  status?: string;
  resellerId?: string;
  productType?: 'PHONE_NUMBER' | 'MODEM' | 'ACTIVATION_CODE';
}

function rangeWhere(range: ReportRange) {
  return {
    ...(range.from || range.to
      ? {
          createdAt: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        }
      : {}),
    ...(range.status ? { status: range.status as never } : {}),
  };
}

/** گزارش سفارش‌ها برای جدول پنل و خروجی اکسل */
export async function getOrdersReport(range: ReportRange, page = 1, limit = 50) {
  const where = rangeWhere(range);
  const [items, total, aggregate] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true, payments: true, user: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { total: true, resellerCommission: true } }),
  ]);
  return {
    items,
    total,
    page,
    limit,
    summary: {
      totalAmount: aggregate._sum.total ?? 0n,
      totalCommission: aggregate._sum.resellerCommission ?? 0n,
    },
  };
}

/** گزارش فروش به تفکیک اپراتور */
export async function getOperatorSalesReport(range: ReportRange) {
  const rows = await prisma.orderItem.groupBy({
    by: ['operatorId'],
    where: {
      productType: { in: ['PHONE_NUMBER', 'ACTIVATION_CODE'] },
      order: { status: { in: [...PAID_STATUSES] }, ...rangeWhere(range) },
    },
    _count: { _all: true },
    _sum: { totalPrice: true, quantity: true },
  });

  const operators = await prisma.operator.findMany();
  return rows
    .map((row) => ({
      operatorId: row.operatorId,
      operatorName: operators.find((o) => o.id === row.operatorId)?.name ?? 'نامشخص',
      ordersCount: row._count._all,
      quantity: row._sum.quantity ?? 0,
      amount: row._sum.totalPrice ?? 0n,
    }))
    .sort((a, b) => (b.amount > a.amount ? 1 : -1));
}

/** گزارش عملکرد نمایندگان */
export async function getResellerSalesReport(range: ReportRange) {
  const rows = await prisma.orderItem.groupBy({
    by: ['resellerId'],
    where: {
      ownerType: 'RESELLER',
      resellerId: { not: null },
      order: { status: { in: [...PAID_STATUSES] }, ...rangeWhere(range) },
    },
    _count: { _all: true },
    _sum: { totalPrice: true, commissionAmount: true },
  });

  const profiles = await prisma.resellerProfile.findMany({
    include: { user: { select: { fullName: true, phone: true } } },
  });

  return rows
    .map((row) => {
      const profile = profiles.find((p) => p.userId === row.resellerId);
      return {
        resellerId: row.resellerId,
        resellerName: profile?.user.fullName ?? 'نامشخص',
        shopName: profile?.shopName ?? '-',
        code: profile?.code ?? '-',
        ordersCount: row._count._all,
        amount: row._sum.totalPrice ?? 0n,
        commission: row._sum.commissionAmount ?? 0n,
        balance: profile?.balance ?? 0n,
      };
    })
    .sort((a, b) => (b.amount > a.amount ? 1 : -1));
}

export interface ExportColumn {
  key: string;
  title: string;
  width: number;
}

export const ORDER_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'orderNumber', title: 'شماره سفارش', width: 20 },
  { key: 'createdAt', title: 'تاریخ ثبت', width: 20 },
  { key: 'customerName', title: 'نام خریدار', width: 20 },
  { key: 'customerPhone', title: 'موبایل خریدار', width: 14 },
  { key: 'itemsSummary', title: 'اقلام', width: 40 },
  { key: 'total', title: 'مبلغ (تومان)', width: 16 },
  { key: 'resellerCommission', title: 'کمیسیون نماینده', width: 16 },
  { key: 'statusLabel', title: 'وضعیت', width: 18 },
  { key: 'refId', title: 'شماره پیگیری بانکی', width: 18 },
  { key: 'trackingCode', title: 'کد رهگیری', width: 16 },
];

export function buildOrderExportRows(orders: Awaited<ReturnType<typeof getOrdersReport>>['items']) {
  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    createdAt: formatJalaliDateTime(order.createdAt, false),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    itemsSummary: order.items.map((i) => `${i.title} × ${i.quantity}`).join(' | '),
    total: formatToman(order.total, false).replace(/٫/g, ''),
    resellerCommission: formatToman(order.resellerCommission, false).replace(/٫/g, ''),
    statusLabel: ORDER_STATUS_LABELS[order.status] ?? order.status,
    refId: order.payments.find((p) => p.status === 'VERIFIED')?.refId ?? '-',
    trackingCode: order.trackingCode,
  }));
}
