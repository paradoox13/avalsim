import { ok, readJson, route } from '@/lib/api';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { notFound } from '@/lib/errors';
import { hashPassword } from '@/lib/auth/password';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  action: z.enum(['status', 'role', 'reset-password']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  roleKey: z.enum(['CUSTOMER', 'RESELLER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  newPassword: z.string().min(10).max(128).optional(),
});

/** مدیریت وضعیت/نقش کاربر و بازنشانی رمز */
export const PATCH = route(async (request, ctx: { params: { id: string } }) => {
  await assertCsrf(request);
  const actor = await requireStaffUser('users.write');
  const input = await readJson(request, patchSchema);

  const target = await prisma.user.findUnique({ where: { id: ctx.params.id } });
  if (!target) throw notFound('کاربر یافت نشد');

  // جلوگیری از حذف دسترسی آخرین مدیر کل
  if (target.roleKey === 'SUPER_ADMIN' && (input.roleKey !== undefined && input.roleKey !== 'SUPER_ADMIN')) {
    const superAdmins = await prisma.user.count({ where: { roleKey: 'SUPER_ADMIN', status: 'ACTIVE' } });
    if (superAdmins <= 1) throw notFound('حداقل یک مدیر کل فعال باید باقی بماند');
  }

  const data: Record<string, unknown> = {};
  if (input.action === 'status' && input.status) data.status = input.status;
  if (input.action === 'role' && input.roleKey) {
    data.roleKey = input.roleKey;
    const role = await prisma.role.findUnique({ where: { key: input.roleKey } });
    data.roleId = role?.id ?? null;
  }
  if (input.action === 'reset-password') {
    if (!input.newPassword) throw notFound('رمز جدید ارسال نشده است');
    data.passwordHash = await hashPassword(input.newPassword);
    data.tokenVersion = { increment: 1 };
  }

  const updated = await prisma.user.update({
    where: { id: ctx.params.id },
    data,
    select: { id: true, fullName: true, roleKey: true, status: true },
  });

  await writeAudit({
    userId: actor.id,
    actorRole: actor.roleKey,
    action: `USER_${input.action.toUpperCase()}`,
    entity: 'User',
    entityId: updated.id,
    before: { roleKey: target.roleKey, status: target.status },
    after: { roleKey: updated.roleKey, status: updated.status },
  });

  return ok(updated);
});
