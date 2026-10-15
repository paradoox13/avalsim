import { fail } from '@/lib/api';
import { requireStaffUser } from '@/lib/guards';
import { buildOrderExportRows, getOrdersReport, ORDER_EXPORT_COLUMNS, getOperatorSalesReport, getResellerSalesReport } from '@/lib/services/report.service';
import { buildExportWorkbook, xlsxHeaders } from '@/lib/excel/export';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { formatToman } from '@/lib/utils/money';
import type { ExportColumn } from '@/lib/services/report.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OPERATOR_COLUMNS: ExportColumn[] = [
  { key: 'operatorName', title: 'اپراتور', width: 20 },
  { key: 'ordersCount', title: 'تعداد سفارش', width: 14 },
  { key: 'quantity', title: 'تعداد کالا', width: 14 },
  { key: 'amount', title: 'مبلغ کل (تومان)', width: 20 },
];

const RESELLER_COLUMNS: ExportColumn[] = [
  { key: 'code', title: 'کد نماینده', width: 14 },
  { key: 'resellerName', title: 'نام نماینده', width: 22 },
  { key: 'shopName', title: 'فروشگاه', width: 22 },
  { key: 'ordersCount', title: 'تعداد فروش', width: 14 },
  { key: 'amount', title: 'مبلغ فروش', width: 20 },
  { key: 'commission', title: 'کمیسیون', width: 18 },
  { key: 'balance', title: 'مانده قابل تسویه', width: 20 },
];

/** خروجی اکسل گزارش‌های مدیریتی */
export async function GET(request: Request) {
  try {
    await requireStaffUser('reports.export');
    const url = new URL(request.url);
    const type = url.searchParams.get('type') ?? 'orders';
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const range = {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      status: url.searchParams.get('status') ?? undefined,
    };

    if (type === 'operators') {
      const rows = (await getOperatorSalesReport(range)).map((row) => ({
        operatorName: row.operatorName,
        ordersCount: row.ordersCount,
        quantity: row.quantity,
        amount: formatToman(row.amount, false).replace(/٫/g, ''),
      }));
      const buffer = await buildExportWorkbook('فروش اپراتورها', OPERATOR_COLUMNS, rows, {
        title: 'گزارش فروش به تفکیک اپراتور',
      });
      return new Response(new Uint8Array(buffer), {
        headers: xlsxHeaders(`operators-report-${new Date().toISOString().slice(0, 10)}.xlsx`),
      });
    }

    if (type === 'resellers') {
      const rows = (await getResellerSalesReport(range)).map((row) => ({
        code: row.code,
        resellerName: row.resellerName,
        shopName: row.shopName,
        ordersCount: row.ordersCount,
        amount: formatToman(row.amount, false).replace(/٫/g, ''),
        commission: formatToman(row.commission, false).replace(/٫/g, ''),
        balance: formatToman(row.balance, false).replace(/٫/g, ''),
      }));
      const buffer = await buildExportWorkbook('عملکرد نمایندگان', RESELLER_COLUMNS, rows, {
        title: 'گزارش عملکرد نمایندگان',
      });
      return new Response(new Uint8Array(buffer), {
        headers: xlsxHeaders(`resellers-report-${new Date().toISOString().slice(0, 10)}.xlsx`),
      });
    }

    const result = await getOrdersReport(range, 1, 5000);
    const buffer = await buildExportWorkbook('گزارش سفارش‌ها', ORDER_EXPORT_COLUMNS, buildOrderExportRows(result.items), {
      title: `گزارش سفارش‌ها تا ${formatJalaliDateTime(new Date(), false)}`,
    });
    return new Response(new Uint8Array(buffer), {
      headers: xlsxHeaders(`orders-report-${new Date().toISOString().slice(0, 10)}.xlsx`),
    });
  } catch (error) {
    return fail(error);
  }
}
