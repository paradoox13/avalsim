import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { buildTemplateWorkbook, templateFileName } from '../src/lib/excel/template';
import { parseModemWorkbook, parsePhoneWorkbook } from '../src/lib/excel/parse';

/**
 * ساخت فایل‌های نمونه‌ی اکسل در پوشه‌ی samples/
 * و بازخوانی آن‌ها برای اطمینان از صحت قالب (round-trip validation).
 */
async function main() {
  const outDir = path.resolve(process.cwd(), 'samples');
  await mkdir(outDir, { recursive: true });

  const results: Array<{ file: string; ok: boolean; note: string }> = [];

  // --- قالب شماره‌ها ---
  const phoneBuffer = await buildTemplateWorkbook('PHONE_NUMBERS', { sampleRows: 3 });
  const phonePath = path.join(outDir, templateFileName('PHONE_NUMBERS'));
  await writeFile(phonePath, phoneBuffer);

  const phoneParsed = await parsePhoneWorkbook(phoneBuffer);
  results.push({
    file: path.basename(phonePath),
    ok:
      phoneParsed.fatalErrors.length === 0 &&
      phoneParsed.rows.length === 3 &&
      phoneParsed.rows.every((row) => row.errors.length === 0 && row.data),
    note: `${phoneParsed.rows.length} سطر خوانده شد، خطا: ${phoneParsed.fatalErrors.join(' | ') || 'ندارد'}`,
  });

  // --- قالب مودم‌ها ---
  const modemBuffer = await buildTemplateWorkbook('MODEMS', { sampleRows: 3 });
  const modemPath = path.join(outDir, templateFileName('MODEMS'));
  await writeFile(modemPath, modemBuffer);

  const modemParsed = await parseModemWorkbook(modemBuffer);
  results.push({
    file: path.basename(modemPath),
    ok:
      modemParsed.fatalErrors.length === 0 &&
      modemParsed.rows.length === 3 &&
      modemParsed.rows.every((row) => row.errors.length === 0 && row.data),
    note: `${modemParsed.rows.length} سطر خوانده شد، خطا: ${modemParsed.fatalErrors.join(' | ') || 'ندارد'}`,
  });

  console.log('\n📄 فایل‌های قالب اکسل:');
  for (const result of results) {
    console.log(`   ${result.ok ? '✅' : '❌'} ${result.file} — ${result.note}`);
  }

  const ok = results.every((r) => r.ok);
  if (!ok) {
    console.error('\n❌ اعتبارسنجی قالب‌ها ناموفق بود');
    process.exit(1);
  }
  console.log('\n✅ قالب‌ها ساخته و اعتبارسنجی شدند.');
}

main().catch((error) => {
  console.error('❌ خطا:', error);
  process.exit(1);
});
