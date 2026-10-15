import { buildTemplateWorkbook, templateFileName } from '@/lib/excel/template';
import { xlsxHeaders } from '@/lib/excel/export';
import { requireApprovedReseller } from '@/lib/guards';
import { fail } from '@/lib/api';
import type { TemplateType } from '@/lib/excel/columns';

export const dynamic = 'force-dynamic';

/** دانلود قالب اکسل شماره‌ها یا مودم‌ها */
export async function GET(request: Request) {
  try {
    await requireApprovedReseller();
    const typeParam = new URL(request.url).searchParams.get('type');
    const type: TemplateType = typeParam === 'MODEMS' ? 'MODEMS' : 'PHONE_NUMBERS';
    const buffer = await buildTemplateWorkbook(type, { sampleRows: 3 });
    return new Response(new Uint8Array(buffer), {
      headers: xlsxHeaders(templateFileName(type)),
    });
  } catch (error) {
    return fail(error);
  }
}
