import { ok, readJson, route } from '@/lib/api';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { notFound } from '@/lib/errors';
import { writeAudit } from '@/lib/audit';
import { getResellerFinancials } from '@/lib/services/settlement.service';

export const dynamic = 'force-dynamic';

export const GET = route(async (_request, ctx: { params: { id: string } }) => {
  await requireStaffUser('resellers.read');
  const profile = await prisma.resellerProfile.findUnique({
    where: { id: ctx.params.id },
    include: { user: { select: { id: true, fullName: true, phone: true, email: true, status: true, nationalId: true } } },
  });
  if (!profile) throw notFound('نماینده یافت نشد');
  const financials = await getResellerFinancials(profile.id);
  return ok({ profile, financials: { ...financials, profile: undefined } });
});

const patchSchema = z.object({
  action: z.enum(['approve', 'suspend', 'activate', 'update']),
  commissionRate: z.coerce.number().int().min(0).max(5000).optional(),
  shopName: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
  shaba: z.string().max(32).optional(),
});

/** تأیید / تعلیق / ویرایش نماینده */
export const PATCH = route(async (request, ctx: { params: { id: string } }) => {
  await assertCsrf(request);
  const user = await requireStaffUser('resellers.write');
  const input = await readJson(request, patchSchema);

  const profile = await prisma.resellerProfile.findUnique({ where: { id: ctx.params.id } });
  if (!profile) throw notFound('نماینده یافت نشد');

  const data: Record<string, unknown> = {};
  if (input.commissionRate !== undefined) data.commissionRate = input.commissionRate;
  if (input.shopName) data.shopName = input.shopName;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.shaba !== undefined) data.shaba = input.shaba;

  if (input.action === 'approve') {
    data.status = 'APPROVED';
    data.approvedAt = new Date();
    data.approvedById = user.id;
  }
  if (input.action === 'suspend') data.status = 'SUSPENDED';
  if (input.action === 'activate') data.status = 'APPROVED';

  const updated = await prisma.resellerProfile.update({ where: { id: ctx.params.id }, data });

  // همگام‌سازی وضعیت کاربر با وضعیت پروفایل
  if (input.action === 'suspend') {
    await prisma.user.update({ where: { id: profile.userId }, data: { status: 'SUSPENDED' } });
  }
  if (input.action === 'approve' || input.action === 'activate') {
    await prisma.user.update({ where: { id: profile.userId }, data: { status: 'ACTIVE' } });
  }

  await writeAudit({
    userId: user.id,
    actorRole: user.roleKey,
    action: `RESELLER_${input.action.toUpperCase()}`,
    entity: 'ResellerProfile',
    entityId: updated.id,
    before: { status: profile.status, commissionRate: profile.commissionRate },
    after: { status: updated.status, commissionRate: updated.commissionRate },
  });

  return ok(updated);
});
