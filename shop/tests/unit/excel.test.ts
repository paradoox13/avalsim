import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildTemplateWorkbook } from '@/lib/excel/template';
import { parseModemWorkbook, parsePhoneWorkbook, cellText } from '@/lib/excel/parse';
import { mapHeaders, missingRequiredColumns } from '@/lib/excel/columns';

async function buildCustomSheet(headers: string[], rows: Array<Array<string | number>>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('داده');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('قالب و ایمپورت اکسل', () => {
  it('قالب شماره‌ها ساخته می‌شود و قابل بازخوانی است', async () => {
    const buffer = await buildTemplateWorkbook('PHONE_NUMBERS', { sampleRows: 3 });
    const parsed = await parsePhoneWorkbook(buffer);
    expect(parsed.fatalErrors).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.every((row) => row.errors.length === 0)).toBe(true);
    expect(parsed.rows[0].data?.msisdn).toBe('09121234567');
  });

  it('قالب مودم‌ها ساخته می‌شود و قابل بازخوانی است', async () => {
    const buffer = await buildTemplateWorkbook('MODEMS', { sampleRows: 2 });
    const parsed = await parseModemWorkbook(buffer);
    expect(parsed.fatalErrors).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].data?.brand).toBe('Huawei');
    expect(parsed.rows[0].data?.stock).toBe(5);
  });

  it('نام‌های معادل ستون‌ها را می‌شناسد (فایل‌های ساخته‌شده توسط کاربر)', async () => {
    const buffer = await buildCustomSheet(
      ['موبایل', 'مبلغ', 'اوپراتور', 'یادداشت'],
      [['۰۹۱۲۳۴۵۶۷۸۹', '۲٫۵۰۰٫۰۰۰', 'همراه اول', 'تست']],
    );
    const parsed = await parsePhoneWorkbook(buffer);
    expect(parsed.fatalErrors).toEqual([]);
    expect(parsed.rows[0].data?.msisdn).toBe('09123456789');
    expect(parsed.rows[0].data?.price).toBe(2500000n);
  });

  it('ستون‌های الزامی غایب را تشخیص می‌دهد', async () => {
    const buffer = await buildCustomSheet(['موضوع', 'متن'], [['الف', 'ب']]);
    const parsed = await parsePhoneWorkbook(buffer);
    expect(parsed.fatalErrors.length).toBeGreaterThan(0);
    expect(parsed.fatalErrors[0]).toContain('قیمت');
  });

  it('سطرهای خراب را جدا می‌کند ولی سطرهای سالم را نگه می‌دارد', async () => {
    const buffer = await buildCustomSheet(
      ['شماره موبایل', 'قیمت (تومان)'],
      [
        ['09121234567', '2500000'],
        ['12345', '1000'],       // شماره نامعتبر
        ['09351234567', 'abc'],  // قیمت نامعتبر
        ['09361234567', '3000000'],
      ],
    );
    const parsed = await parsePhoneWorkbook(buffer);
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows[0].data).toBeDefined();
    expect(parsed.rows[1].data).toBeUndefined();
    expect(parsed.rows[1].errors[0]).toContain('نامعتبر');
    expect(parsed.rows[2].data).toBeUndefined();
    expect(parsed.rows[3].data).toBeDefined();
  });

  it('آدرس تصویر نامعتبر در مودم را رد می‌کند', async () => {
    const buffer = await buildCustomSheet(
      ['برند', 'مدل', 'عنوان محصول', 'قیمت', 'موجودی', 'آدرس تصویر'],
      [['Huawei', 'B315', 'مودم هوآوی', '3200000', '5', 'not-a-url']],
    );
    const parsed = await parseModemWorkbook(buffer);
    expect(parsed.rows[0].errors.join(' ')).toContain('آدرس تصویر');
  });

  it('حداکثر تعداد سطر را اعمال می‌کند', async () => {
    const rows = Array.from({ length: 10 }, (_, index) => [`091212345${index}`, '1000000']);
    const buffer = await buildCustomSheet(['شماره موبایل', 'قیمت'], rows);
    const parsed = await parsePhoneWorkbook(buffer, { maxRows: 5 });
    expect(parsed.fatalErrors.join(' ')).toContain('بیش از حد مجاز');
  });

  it('فایل غیراکسل را با پیام مناسب رد می‌کند', async () => {
    const parsed = await parsePhoneWorkbook(Buffer.from('this is not an xlsx'));
    expect(parsed.fatalErrors[0]).toContain('قابل خواندن نیست');
  });

  it('استخراج متن از انواع سلول‌ها', () => {
    expect(cellText('متن')).toBe('متن');
    expect(cellText(123)).toBe('123');
    expect(cellText(null)).toBe('');
    expect(cellText({ richText: [{ text: 'ا' }, { text: 'ب' }] })).toBe('اب');
    expect(cellText({ formula: 'A1', result: 'نتیجه' })).toBe('نتیجه');
  });

  it('نگاشت سرستون‌ها و تشخیص ستون‌های غایب', () => {
    const mapped = mapHeaders(['شماره موبایل', 'قیمت (تومان)'], 'PHONE_NUMBERS');
    expect(mapped.get('msisdn')).toBe(1);
    expect(mapped.get('price')).toBe(2);
    expect(missingRequiredColumns(mapped, 'PHONE_NUMBERS')).toEqual([]);
    expect(missingRequiredColumns(new Map(), 'MODEMS').length).toBeGreaterThan(0);
  });
});
