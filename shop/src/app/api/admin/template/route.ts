import { fail } from '@/lib/api';
import { requireStaffUser } from '@/lib/guards';
import { buildTemplateWorkbook, templateFileName } from '@/lib/excel/template';
import { xlsxHeaders } from '@/lib/excel/export';
import type { TemplateType } from '@/lib/excel/columns';

export const dynamic = 'force-dynamic';

/** دانلود قالب اکسل (ادمین) */
export async function GET(request: Request) {
  try {
    await requireStaffUser('products.phones.read');
    const typeParam = new URL(request.url).searchParams.get('type');
    const type: TemplateType = typeParam === 'MODEMS' ? 'MODEMS' : 'PHONE_NUMBERS';
    const buffer = await buildTemplateWorkbook(type, { sampleRows: 3 });
    return new Response(new Uint8Array(buffer), { headers: xlsxHeaders(templateFileName(type)) });
  } catch (error) {
    return fail(error);
  }
}
