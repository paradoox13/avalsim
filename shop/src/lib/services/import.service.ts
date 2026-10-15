import { prisma } from '../prisma';
import { writeAudit } from '../audit';
import { getUserFacingOperatorName } from './operator.service';
import { analyzeNumber } from '../utils/pattern';
import { extractMiddle, extractPrefix, extractSuffix, detectOperatorCode } from '../filters/operator-detect';
import { normalizePersianText } from '../utils/persian';
import { getSettingNumber } from '../settings';
import { buildModemDedupeKey } from './modem.service';
import { isStaffActor, type Actor } from './phone.service';
import type { ParsedRow, ParsedModemRow, ParsedPhoneRow } from '../excel/parse';

export interface ImportSummary {
  logId: string;
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
}

export interface ImportMeta {
  fileName: string;
  fileSize: number;
}

function buildSummary(
  logId: string,
  rows: ParsedRow<unknown>[],
  created: number,
  skippedSent: Array<{ row: number; message: string }>,
): ImportSummary {
  const failed = skippedSent.length;
  const status: ImportSummary['status'] =
    created === 0 && failed > 0 ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'COMPLETED';
  return {
    logId,
    total: rows.length,
    created,
    skipped: skippedSent.filter((e) => e.message.includes('تکراری')).length,
    failed,
    errors: skippedSent.slice(0, 200),
    status,
  };
}

/**
 * ایمپورت گروهی شماره‌ها از اکسل.
 * - شماره‌های تکراری (در فایل یا در دیتابیس) رد می‌شوند
 * - اپراتور به‌صورت خودکار از پیش‌شماره تشخیص داده می‌شود
 * - ویژگی‌های رند/متوالی/تکراری محاسبه و ذخیره می‌شود
 */
export async function importPhoneNumbers(
  rows: ParsedRow<ParsedPhoneRow>[],
  actor: Actor,
  meta: ImportMeta,
): Promise<ImportSummary> {
  const log = await prisma.excelImportLog.create({
    data: {
      userId: actor.userId,
      type: 'PHONE_NUMBER' as const,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      totalRows: rows.length,
      status: 'PROCESSING',
    },
  });

  const errors: Array<{ row: number; message: string }> = [];
  const ownerType = isStaffActor(actor) ? 'PLATFORM' : 'RESELLER';
  if (ownerType === 'RESELLER' && !actor.resellerId) {
    await prisma.excelImportLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', finishedAt: new Date(), errors: [{ row: 0, message: 'پروفایل نمایندگی تکمیل نیست' }] },
    });
    return buildSummary(log.id, rows, 0, [{ row: 0, message: 'پروفایل نمایندگی تکمیل نیست' }]);
  }

  const operators = await prisma.operator.findMany();
  const operatorByCode = new Map(operators.map((o) => [o.code, o.id]));
  const operatorByName = new Map(
    operators.map((o) => [normalizePersianText(o.name).toLowerCase(), o.id]),
  );
  for (const op of operators) operatorByName.set(op.nameEn.toLowerCase(), op.id);

  // سطرهای معتبر
  const candidates: Array<{ row: number; data: ParsedPhoneRow; operatorId: string }> = [];
  for (const row of rows) {
    if (row.errors.length || !row.data) {
      errors.push({ row: row.rowNumber, message: row.errors.join('، ') || 'سطر نامعتبر' });
      continue;
    }
    let operatorId: string | undefined;
    if (row.data.operatorName) {
      operatorId = operatorByName.get(normalizePersianText(row.data.operatorName).toLowerCase());
    }
    if (!operatorId) operatorId = operatorByCode.get(detectOperatorCode(row.data.msisdn));
    if (!operatorId) operatorId = operatorByCode.get('OTHER');
    if (!operatorId) {
      errors.push({ row: row.rowNumber, message: 'اپراتور مشخص نشد' });
      continue;
    }
    candidates.push({ row: row.rowNumber, data: row.data, operatorId });
  }

  // تکراری‌های داخل فایل
  const seen = new Set<string>();
  const unique: typeof candidates = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.data.msisdn)) {
      errors.push({ row: candidate.row, message: `شماره ${candidate.data.msisdn} در فایل تکراری است` });
      continue;
    }
    seen.add(candidate.data.msisdn);
    unique.push(candidate);
  }

  // تکراری‌های موجود در دیتابیس
  const existing = new Set<string>();
  const chunkSize = 1000;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize).map((c) => c.data.msisdn);
    const found = await prisma.phoneNumber.findMany({
      where: { msisdn: { in: chunk } },
      select: { msisdn: true },
    });
    for (const f of found) existing.add(f.msisdn);
  }

  const threshold = await getSettingNumber('shop.rondThreshold');
  const toCreate = unique.filter((c) => {
    if (existing.has(c.data.msisdn)) {
      errors.push({ row: c.row, message: `شماره ${c.data.msisdn} قبلاً ثبت شده است (تکراری)` });
      return false;
    }
    return true;
  });

  let created = 0;
  if (toCreate.length) {
    const data = toCreate.map((c) => {
      const analysis = analyzeNumber(c.data.msisdn, threshold);
      return {
        msisdn: c.data.msisdn,
        operatorId: c.operatorId,
        prefix: extractPrefix(c.data.msisdn),
        suffix: extractSuffix(c.data.msisdn),
        middle: extractMiddle(c.data.msisdn),
        length: c.data.msisdn.length,
        price: c.data.price,
        description: c.data.description ?? null,
        ownerType: ownerType as 'PLATFORM' | 'RESELLER',
        resellerId: ownerType === 'RESELLER' ? actor.resellerId! : null,
        isRond: analysis.isRond,
        isSequential: analysis.isSequential,
        isRepeated: analysis.isRepeated,
        isPalindrome: analysis.isPalindrome,
        rondScore: analysis.rondScore,
      };
    });

    for (let i = 0; i < data.length; i += 500) {
      const batch = data.slice(i, i + 500);
      const result = await prisma.phoneNumber.createMany({ data: batch, skipDuplicates: true });
      created += result.count;
    }
  }

  const summary = buildSummary(log.id, rows, created, errors);
  await prisma.excelImportLog.update({
    where: { id: log.id },
    data: {
      status: summary.status,
      successRows: created,
      failedRows: errors.length,
      errors: errors.slice(0, 200),
      finishedAt: new Date(),
    },
  });
  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'IMPORT',
    entity: 'PhoneNumber',
    entityId: log.id,
    after: { created, failed: errors.length, file: meta.fileName },
  });

  return summary;
}

/** ایمپورت گروهی مودم‌ها از اکسل */
export async function importModems(
  rows: ParsedRow<ParsedModemRow>[],
  actor: Actor,
  meta: ImportMeta,
): Promise<ImportSummary> {
  const log = await prisma.excelImportLog.create({
    data: {
      userId: actor.userId,
      type: 'MODEM' as const,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      totalRows: rows.length,
      status: 'PROCESSING',
    },
  });

  const errors: Array<{ row: number; message: string }> = [];
  const ownerType = isStaffActor(actor) ? 'PLATFORM' : 'RESELLER';
  if (ownerType === 'RESELLER' && !actor.resellerId) {
    await prisma.excelImportLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', finishedAt: new Date() },
    });
    return buildSummary(log.id, rows, 0, [{ row: 0, message: 'پروفایل نمایندگی تکمیل نیست' }]);
  }

  const owner = {
    type: ownerType as 'PLATFORM' | 'RESELLER',
    resellerId: ownerType === 'RESELLER' ? actor.resellerId : null,
  };

  const candidates: Array<{ row: number; data: ParsedModemRow; dedupeKey: string }> = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.errors.length || !row.data) {
      errors.push({ row: row.rowNumber, message: row.errors.join('، ') || 'سطر نامعتبر' });
      continue;
    }
    const dedupeKey = buildModemDedupeKey(owner, row.data.brand, row.data.model);
    if (seen.has(dedupeKey)) {
      errors.push({ row: row.rowNumber, message: 'این مودم (برند+مدل) در فایل تکراری است' });
      continue;
    }
    seen.add(dedupeKey);
    candidates.push({ row: row.rowNumber, data: row.data, dedupeKey });
  }

  const existing = new Set<string>();
  if (candidates.length) {
    const keys = candidates.map((c) => c.dedupeKey);
    for (let i = 0; i < keys.length; i += 1000) {
      const found = await prisma.modem.findMany({
        where: { dedupeKey: { in: keys.slice(i, i + 1000) } },
        select: { dedupeKey: true },
      });
      for (const f of found) existing.add(f.dedupeKey);
    }
  }

  const toCreate = candidates.filter((c) => {
    if (existing.has(c.dedupeKey)) {
      errors.push({
        row: c.row,
        message: `مودم ${c.data.brand} ${c.data.model} قبلاً ثبت شده است (تکراری)`,
      });
      return false;
    }
    return true;
  });

  let created = 0;
  if (toCreate.length) {
    const data = toCreate.map((c) => ({
      sku: `MDM-${c.data.brand}-${c.data.model}`
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .toUpperCase()
        .slice(0, 60),
      dedupeKey: c.dedupeKey,
      brand: normalizePersianText(c.data.brand),
      model: normalizePersianText(c.data.model),
      title: normalizePersianText(c.data.title),
      price: c.data.price,
      stock: c.data.stock,
      warranty: c.data.warranty ?? null,
      imageUrl: c.data.imageUrl ?? null,
      description: c.data.description ?? null,
      ownerType: owner.type,
      resellerId: owner.resellerId,
      isActive: c.data.stock > 0,
    }));

    for (let i = 0; i < data.length; i += 500) {
      const result = await prisma.modem.createMany({ data: data.slice(i, i + 500), skipDuplicates: true });
      created += result.count;
    }
  }

  const summary = buildSummary(log.id, rows, created, errors);
  await prisma.excelImportLog.update({
    where: { id: log.id },
    data: {
      status: summary.status,
      successRows: created,
      failedRows: errors.length,
      errors: errors.slice(0, 200),
      finishedAt: new Date(),
    },
  });
  await writeAudit({
    userId: actor.userId,
    actorRole: actor.roleKey,
    action: 'IMPORT',
    entity: 'Modem',
    entityId: log.id,
    after: { created, failed: errors.length, file: meta.fileName },
  });

  return summary;
}
