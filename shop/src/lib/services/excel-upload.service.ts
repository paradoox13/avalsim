import { badRequest } from '../errors';
import { getSettingNumber } from '../settings';
import { parseModemWorkbook, parsePhoneWorkbook } from '../excel/parse';
import { importModems, importPhoneNumbers, type ImportSummary } from './import.service';
import type { TemplateType } from '../excel/columns';
import type { Actor } from './phone.service';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xlsm'];
const ALLOWED_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/octet-stream',
];

export interface UploadResult extends ImportSummary {
  parseErrors: Array<{ row: number; message: string }>;
  mappedColumns: string[];
}

/**
 * پردازش آپلود فایل اکسل (نماینده یا ادمین).
 * اعتبارسنجی: نوع فایل، حجم، تعداد سطر و ساختار ستون‌ها.
 */
export async function processExcelUpload(
  request: Request,
  actor: Actor,
  expectedType: TemplateType,
): Promise<UploadResult> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw badRequest('فرم آپلود نامعتبر است');
  }

  const file = formData.get('file');
  const typeField = formData.get('type');

  if (!(file instanceof File)) throw badRequest('فایلی انتخاب نشده است');

  const type: TemplateType =
    typeField === 'MODEMS' || typeField === 'PHONE_NUMBERS'
      ? (typeField as TemplateType)
      : expectedType;

  if (type !== expectedType) {
    throw badRequest(`نوع فایل انتخابی با این بخش سازگار نیست (انتظار: ${expectedType})`);
  }

  const name = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw badRequest('فقط فایل‌های اکسل با پسوند xlsx پذیرفته می‌شوند');
  }
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    throw badRequest('نوع فایل نامعتبر است');
  }

  const maxMb = (await getSettingNumber('excel.maxFileSizeMb')) || 5;
  if (file.size > maxMb * 1024 * 1024) {
    throw badRequest(`حجم فایل بیش از ${maxMb} مگابایت است`);
  }
  if (file.size === 0) throw badRequest('فایل خالی است');

  const maxRows = (await getSettingNumber('excel.maxRows')) || 5000;
  const buffer = Buffer.from(await file.arrayBuffer());
  const meta = { fileName: file.name, fileSize: file.size };

  if (type === 'PHONE_NUMBERS') {
    const parsed = await parsePhoneWorkbook(buffer, { maxRows });
    if (parsed.fatalErrors.length) throw badRequest(parsed.fatalErrors.join(' | '));
    const summary = await importPhoneNumbers(parsed.rows, actor, meta);
    return {
      ...summary,
      parseErrors: parsed.rows
        .filter((r) => r.errors.length)
        .map((r) => ({ row: r.rowNumber, message: r.errors.join('، ') })),
      mappedColumns: parsed.mappedColumns,
    };
  }

  const parsed = await parseModemWorkbook(buffer, { maxRows });
  if (parsed.fatalErrors.length) throw badRequest(parsed.fatalErrors.join(' | '));
  const summary = await importModems(parsed.rows, actor, meta);
  return {
    ...summary,
    parseErrors: parsed.rows
      .filter((r) => r.errors.length)
      .map((r) => ({ row: r.rowNumber, message: r.errors.join('، ') })),
    mappedColumns: parsed.mappedColumns,
  };
}
