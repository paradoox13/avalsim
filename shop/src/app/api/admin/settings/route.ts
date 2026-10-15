import { ok, readJson, route } from '@/lib/api';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { getAllSettingsForAdmin, setSetting, SETTING_DEFS } from '@/lib/settings';
import { writeAudit } from '@/lib/audit';
import { badRequest } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** لیست همه‌ی تنظیمات (مقادیر SECRET ماسک‌شده) */
export const GET = route(async () => {
  await requireStaffUser('settings.read');
  const settings = await getAllSettingsForAdmin();
  return ok({
    settings: settings.map((s) => ({
      key: s.key,
      label: s.label,
      group: s.group,
      type: s.type,
      value: s.stored,
      isSet: s.isSet,
      isPublic: s.isPublic ?? false,
      description: s.description ?? null,
    })),
    groups: [...new Set(SETTING_DEFS.map((s) => s.group))],
  });
});

const putSchema = z.object({
  values: z.record(z.string(), z.string().max(2000)),
});

/** به‌روزرسانی گروهی تنظیمات */
export const PUT = route(async (request) => {
  await assertCsrf(request);
  const user = await requireStaffUser('settings.write');
  const { values } = await readJson(request, putSchema);

  const updated: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const def = SETTING_DEFS.find((d) => d.key === key);
    if (!def) throw badRequest(`تنظیم ناشناخته: ${key}`);
    // مقدار ماسک‌شده یعنی کاربر تغییری نداده است
    if (def.type === 'SECRET' && value === '********') continue;
    await setSetting(key, value, user.id);
    updated.push(key);
  }

  await writeAudit({
    userId: user.id,
    actorRole: user.roleKey,
    action: 'UPDATE',
    entity: 'Setting',
    after: { keys: updated },
  });

  return ok({ updated, count: updated.length });
});
