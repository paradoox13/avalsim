import ExcelJS from 'exceljs';
import { normalizeMsisdn } from '../filters/operator-detect';
import { toEnglishDigits } from '../utils/persian';
import { mapHeaders, missingRequiredColumns, type TemplateType } from './columns';

export interface ParsedRow<T> {
  rowNumber: number;
  data?: T;
  errors: string[];
  raw: Record<string, string>;
}

export interface ParseResult<T> {
  rows: ParsedRow<T>[];
  /** خطاهایی که مانع ادامه‌ی کل فایل می‌شوند */
  fatalErrors: string[];
  mappedColumns: string[];
  missingColumns: string[];
  totalRows: number;
}

export interface ParsedPhoneRow {
  msisdn: string;
  price: bigint;
  operatorName?: string;
  description?: string;
}

export interface ParsedModemRow {
  brand: string;
  model: string;
  title: string;
  price: bigint;
  stock: number;
  warranty?: string;
  imageUrl?: string;
  description?: string;
}

/** استخراج متن از سلول اکسل در همه‌ی حالت‌های ممکن (فرمول، لینک، متن غنی) */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const obj = value as unknown as Record<string, unknown>;
    if ('richText' in obj && Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>).map((r) => r.text ?? '').join('').trim();
    }
    if ('text' in obj) return String(obj.text ?? '').trim();
    if ('result' in obj) return cellText(obj.result as ExcelJS.CellValue);
    if ('hyperlink' in obj) return String(obj.hyperlink ?? '').trim();
  }
  return String(value).trim();
}

function parseAmount(input: string): bigint | null {
  const digits = toEnglishDigits(input).replace(/[^\d]/g, '');
  if (!digits) return null;
  try {
    return BigInt(digits);
  } catch {
    return null;
  }
}

/** خواندن سطرهای یک شیت تا اولین سطر کاملاً خالی */
function readSheet(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = cellText(cell.value);
  });

  const dataRows: Array<{ rowNumber: number; cells: string[] }> = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: string[] = [];
    let hasContent = false;
    for (let c = 1; c <= headers.length; c += 1) {
      const text = cellText(row.getCell(c).value);
      cells[c - 1] = text;
      if (text) hasContent = true;
    }
    if (hasContent) dataRows.push({ rowNumber, cells });
  });

  return { headers, dataRows };
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

/**
 * پارس و اعتبارسنجی فایل اکسل شماره‌ها.
 * هر سطر جداگانه اعتبارسنجی می‌شود تا سطرهای سالم حتی با وجود سطر خراب وارد شوند.
 */
export async function parsePhoneWorkbook(
  buffer: Buffer,
  options: { maxRows?: number } = {},
): Promise<ParseResult<ParsedPhoneRow>> {
  return parseWorkbook<ParsedPhoneRow>(buffer, 'PHONE_NUMBERS', options, (get) => {
    const errors: string[] = [];
    const raw = get.raw;

    const msisdn = normalizeMsisdn(get('msisdn'));
    if (!msisdn) errors.push('شماره موبایل نامعتبر است');

    const price = parseAmount(get('price'));
    if (price === null) errors.push('قیمت نامعتبر است');
    else if (price <= 0n) errors.push('قیمت باید بزرگ‌تر از صفر باشد');
    else if (price > 10n ** 12n) errors.push('قیمت بیش از حد بزرگ است');

    return {
      rowNumber: get.rowNumber,
      errors,
      raw,
      data:
        msisdn && price !== null && errors.length === 0
          ? {
              msisdn,
              price,
              operatorName: get('operator') || undefined,
              description: get('description') || undefined,
            }
          : undefined,
    };
  });
}

/** پارس و اعتبارسنجی فایل اکسل مودم‌ها */
export async function parseModemWorkbook(
  buffer: Buffer,
  options: { maxRows?: number } = {},
): Promise<ParseResult<ParsedModemRow>> {
  return parseWorkbook<ParsedModemRow>(buffer, 'MODEMS', options, (get) => {
    const errors: string[] = [];
    const raw = get.raw;

    const brand = get('brand');
    const model = get('model');
    const title = get('title') || (brand && model ? `${brand} ${model}` : '');
    if (!brand) errors.push('برند الزامی است');
    if (!model) errors.push('مدل الزامی است');
    if (!title) errors.push('عنوان محصول الزامی است');

    const price = parseAmount(get('price'));
    if (price === null) errors.push('قیمت نامعتبر است');
    else if (price <= 0n) errors.push('قیمت باید بزرگ‌تر از صفر باشد');

    const stockRaw = toEnglishDigits(get('stock')).replace(/[^\d-]/g, '');
    const stock = stockRaw ? Number(stockRaw) : Number.NaN;
    if (!Number.isInteger(stock) || stock < 0) errors.push('موجودی نامعتبر است');

    const imageUrl = get('imageUrl');
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      errors.push('آدرس تصویر باید با http یا https شروع شود');
    }

    return {
      rowNumber: get.rowNumber,
      errors,
      raw,
      data:
        errors.length === 0 && price !== null
          ? {
              brand,
              model,
              title,
              price,
              stock,
              warranty: get('warranty') || undefined,
              imageUrl: imageUrl || undefined,
              description: get('description') || undefined,
            }
          : undefined,
    };
  });
}

interface GetCell {
  (key: string): string;
  rowNumber: number;
  raw: Record<string, string>;
}

async function parseWorkbook<T>(
  buffer: Buffer,
  type: TemplateType,
  options: { maxRows?: number },
  mapper: (get: GetCell) => ParsedRow<T>,
): Promise<ParseResult<T>> {
  const fatalErrors: string[] = [];
  let workbook: ExcelJS.Workbook;
  try {
    workbook = await loadWorkbook(buffer);
  } catch {
    return {
      rows: [],
      fatalErrors: ['فایل اکسل قابل خواندن نیست. مطمئن شوید فرمت فایل xlsx است.'],
      mappedColumns: [],
      missingColumns: [],
      totalRows: 0,
    };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return {
      rows: [],
      fatalErrors: ['فایل هیچ شیتی ندارد'],
      mappedColumns: [],
      missingColumns: [],
      totalRows: 0,
    };
  }

  const { headers, dataRows } = readSheet(sheet);
  const mapped = mapHeaders(headers, type);
  const missing = missingRequiredColumns(mapped, type);

  if (missing.length) {
    return {
      rows: [],
      fatalErrors: [
        `ستون‌های الزامی زیر در فایل پیدا نشد: ${missing.join('، ')}. لطفاً از فایل قالب استفاده کنید.`,
      ],
      mappedColumns: [...mapped.keys()],
      missingColumns: missing,
      totalRows: dataRows.length,
    };
  }

  const maxRows = options.maxRows ?? 5000;
  if (dataRows.length > maxRows) {
    fatalErrors.push(`تعداد سطرهای فایل (${dataRows.length}) بیش از حد مجاز (${maxRows}) است.`);
  }

  const rows: ParsedRow<T>[] = [];
  for (const { rowNumber, cells } of dataRows.slice(0, maxRows)) {
    const raw: Record<string, string> = {};
    const get = ((key: string): string => {
      const index = mapped.get(key);
      return index !== undefined ? cells[index - 1] ?? '' : '';
    }) as GetCell;
    get.rowNumber = rowNumber;
    get.raw = raw;
    for (const key of mapped.keys()) raw[key] = get(key);
    rows.push(mapper(get));
  }

  return {
    rows,
    fatalErrors,
    mappedColumns: [...mapped.keys()],
    missingColumns: [],
    totalRows: dataRows.length,
  };
}
