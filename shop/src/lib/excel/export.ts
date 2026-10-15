import ExcelJS from 'exceljs';
import { formatJalaliDateTime } from '../utils/jalali';
import type { ExportColumn } from '../services/report.service';

/**
 * ساخت فایل اکسل خروجی گزارش با همان ظاهر قالب‌های ورودی.
 */
export async function buildExportWorkbook(
  sheetName: string,
  columns: ExportColumn[],
  rows: Array<Record<string, string | number>>,
  meta?: { title?: string; generatedBy?: string },
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SimShop';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = columns.map((c) => ({ header: c.title, key: c.key, width: c.width }));

  const header = sheet.getRow(1);
  header.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  header.height = 24;
  header.alignment = { horizontal: 'center', vertical: 'middle' };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  });

  for (const row of rows) sheet.addRow(row);

  const info = workbook.addWorksheet('اطلاعات گزارش', { views: [{ rightToLeft: true }] });
  info.columns = [
    { header: 'عنوان', key: 'k', width: 26 },
    { header: 'مقدار', key: 'v', width: 40 },
  ];
  info.addRow({ k: 'عنوان گزارش', v: meta?.title ?? sheetName });
  info.addRow({ k: 'تاریخ تولید', v: formatJalaliDateTime(new Date()) });
  info.addRow({ k: 'تعداد رکورد', v: String(rows.length) });
  if (meta?.generatedBy) info.addRow({ k: 'تولیدکننده', v: meta.generatedBy });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** سرستون‌های پاسخ دانلود فایل اکسل */
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function xlsxHeaders(filename: string): HeadersInit {
  return {
    'Content-Type': XLSX_CONTENT_TYPE,
    'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Cache-Control': 'no-store',
  };
}
