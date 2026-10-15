import ExcelJS from 'exceljs';
import { columnsFor, type TemplateType } from './columns';

export interface TemplateOptions {
  /** تعداد سطر نمونه */
  sampleRows?: number;
}

/**
 * ساخت فایل قالب اکسل با یک شیت راهنما.
 * فایل تولیدشده راست‌چین است و سرستون‌ها با رنگ و راهنما مشخص شده‌اند.
 */
export async function buildTemplateWorkbook(
  type: TemplateType,
  options: TemplateOptions = {},
): Promise<Buffer> {
  const columns = columnsFor(type);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SimShop';
  workbook.created = new Date();

  const sheetName = type === 'PHONE_NUMBERS' ? 'شماره‌ها' : 'مودم‌ها';
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = columns.map((c) => ({
    header: c.required ? `${c.title} *` : c.title,
    key: c.key,
    width: c.width,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F766E' } },
      left: { style: 'thin', color: { argb: 'FF0F766E' } },
      bottom: { style: 'thin', color: { argb: 'FF0F766E' } },
      right: { style: 'thin', color: { argb: 'FF0F766E' } },
    };
  });

  // نمونه‌ها
  const samples = sampleRowsFor(type, options.sampleRows ?? 3);
  for (const sample of samples) sheet.addRow(sample);

  for (let i = 2; i <= samples.length + 1; i += 1) {
    sheet.getRow(i).alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // شیت راهنما
  const help = workbook.addWorksheet('راهنما', { views: [{ rightToLeft: true }] });
  help.columns = [
    { header: 'ستون', key: 'col', width: 22 },
    { header: 'الزامی؟', key: 'required', width: 10 },
    { header: 'توضیح', key: 'note', width: 60 },
    { header: 'نمونه', key: 'example', width: 24 },
  ];
  help.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  help.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  });
  for (const column of columns) {
    help.addRow({
      col: column.title,
      required: column.required ? 'بله' : 'خیر',
      note: column.note ?? (column.required ? 'پُر کردن این ستون الزامی است' : 'اختیاری'),
      example: String(column.example),
    });
  }
  help.addRow({});
  help.addRow({
    col: 'نکته مهم',
    required: '-',
    note: 'سطر اول فایل را حذف نکنید؛ سرستون‌ها باید حفظ شوند. حداکثر حجم فایل ۵ مگابایت و حداکثر ۵۰۰۰ سطر است. اعداد را می‌توانید فارسی هم وارد کنید.',
    example: '',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function sampleRowsFor(type: TemplateType, count: number) {
  if (type === 'PHONE_NUMBERS') {
    const base = [
      ['09121234567', 2500000, 'همراه اول', 'شماره معمولی'],
      ['09351234567', 18900000, 'ایرانسل', 'چهار رقم آخر یکسان'],
      ['09201234567', 5300000, 'رایتل', ''],
    ];
    return base.slice(0, count);
  }
  const base = [
    ['Huawei', 'B315s-22', 'مودم LTE هوآوی B315s-22', 3200000, 5, '۱۸ ماه شرکتی', '', 'قابل استفاده با سیم‌کارت همراه اول'],
    ['TP-Link', 'MR200', 'مودم TP-Link MR200', 2450000, 3, '۱۲ ماه', '', ''],
    ['ZTE', 'MF286R', 'مودم ZTE MF286R', 2980000, 4, '۶ ماه', '', ''],
  ];
  return base.slice(0, count);
}

/** نام فایل پیشنهادی برای دانلود */
export function templateFileName(type: TemplateType): string {
  return type === 'PHONE_NUMBERS' ? 'phone-numbers-template.xlsx' : 'modems-template.xlsx';
}
