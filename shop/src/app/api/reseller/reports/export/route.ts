import { fail } from '@/lib/api';
import { requireApprovedReseller } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { buildExportWorkbook, xlsxHeaders } from '@/lib/excel/export';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { formatToman } from '@/lib/utils/money';
import { ORDER_STATUS_LABELS } from '@/lib/sms/templates';
import type { ExportColumn } from '@/lib/services/report.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const COLUMNS: ExportColumn[] = [
  { key: 'soldAt', title: 'تاریخ فروش', width: 20 },
  { key: 'orderNumber', title: 'شماره سفارش', width: 20 },
  { key: 'title', title: 'محصول', width: 34 },
  { key: 'productType', title: 'نوع', width: 16 },
  { key: 'quantity', title: 'تعداد', width: 10 },
  { key: 'unitPrice', title: 'قیمت واحد', width: 16 },
  { key: 'totalPrice', title: 'مبلغ کل', width: 16 },
  { key: 'commission', title: 'کمیسیون', width: 16 },
  { key: 'buyer', title: 'خریدار', width: 20 },
  { key: 'status', title: 'وضعیت سفارش', width: 18 },
];

const TYPE_LABELS: Record<string, string> = {
  PHONE_NUMBER: 'شماره سیم‌کارت',
  MODEM: 'مودم',
  ACTIVATION_CODE: 'کد فعال‌سازی',
};

/** خروجی اکسل گزارش فروش نماینده */
export async function GET(request: Request) {
  try {
    const { resellerId, userId } = await requireApprovedReseller();
    const url = new URL(request.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const items = await prisma.orderItem.findMany({
      where: {
        resellerId: userId,
        ...(fromParam || toParam
          ? {
              createdAt: {
                ...(fromParam ? { gte: new Date(fromParam) } : {}),
                ...(toParam ? { lte: new Date(toParam) } : {}),
              },
            }
          : {}),
        order: { status: { in: ['PAID', 'PROCESSING', 'AWAITING_PHYSICAL_DELIVERY', 'SHIPPED', 'DELIVERED'] } },
      },
      include: { order: { select: { orderNumber: true, customerName: true, status: true, paidAt: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const rows = items.map((item) => ({
      soldAt: item.order.paidAt ? formatJalaliDateTime(item.order.paidAt, false) : '-',
      orderNumber: item.order.orderNumber,
      title: item.title,
      productType: TYPE_LABELS[item.productType] ?? item.productType,
      quantity: item.quantity,
      unitPrice: formatToman(item.unitPrice, false).replace(/٫/g, ''),
      totalPrice: formatToman(item.totalPrice, false).replace(/٫/g, ''),
      commission: formatToman(item.commissionAmount, false).replace(/٫/g, ''),
      buyer: item.order.customerName,
      status: ORDER_STATUS_LABELS[item.order.status] ?? item.order.status,
    }));

    const buffer = await buildExportWorkbook('گزارش فروش', COLUMNS, rows, {
      title: 'گزارش فروش نماینده',
      generatedBy: resellerId,
    });
    const filename = `sales-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new Response(new Uint8Array(buffer), { headers: xlsxHeaders(filename) });
  } catch (error) {
    return fail(error);
  }
}
