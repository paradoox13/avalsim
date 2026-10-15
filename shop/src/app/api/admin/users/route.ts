import { ok, paginated, readJson, readQuery, route } from '@/lib/api';
import { z } from 'zod';
import { assertCsrf } from '@/lib/csrf';
import { requireStaffUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { conflict } from '@/lib/errors';
import { writeAudit } from '@/lib/audit';
import { persianText } from '@/lib/validation/common';
import { PERMISSION_CATALOG } from '@/lib/auth/rbac';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  roleKey: z.enum(['CUSTOMER', 'RESELLER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'PENDING', 'SUSPENDED']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(100).catch(30),
});

/** لیست کاربران + نقش‌ها و دسترسی‌ها */
export const GET = route(async (request) => {
  await requireStaffUser('users.read');
  const query = readQuery(request, querySchema);
  const where = {
    ...(query.roleKey ? { roleKey: query.roleKey } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { fullName: { contains: query.q } },
            { phone: { contains: query.q } },
            { username: { contains: query.q } },
            { email: { contains: query.q } },
          ],
        }
      : {}),
  };

  const [items, total, roles] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        username: true,
        roleKey: true,
        status: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.user.count({ where }),
    prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { level: 'desc' },
    }),
  ]);

  return paginated(
    items,
    { page: query.page, limit: query.limit, total },
  );
});

const createSchema = z.object({
  fullName: persianText(120, 3),
  phone: z.string().min(10).max(13),
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/, 'نام کاربری فقط حروف لاتین، عدد و . _ -'),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(10).max(128),
  roleKey: z.enum(['ADMIN', 'SUPER_ADMIN', 'RESELLER', 'CUSTOMER']),
});

/** ساخت کاربر کارکنان (نیازمند دسترسی مدیریت کاربران) */
export const POST = route(async (request) => {
  await assertCsrf(request);
  const actor = await requireStaffUser('users.write');
  const input = await readJson(request, createSchema);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { phone: input.phone }] },
  });
  if (existing) throw conflict('کاربری با این نام کاربری یا موبایل وجود دارد');

  const role = await prisma.role.findUnique({ where: { key: input.roleKey } });

  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
      username: input.username,
      email: input.email || null,
      passwordHash: await hashPassword(input.password),
      roleKey: input.roleKey,
      roleId: role?.id ?? null,
      status: 'ACTIVE',
    },
    select: { id: true, fullName: true, username: true, roleKey: true },
  });

  await writeAudit({
    userId: actor.id,
    actorRole: actor.roleKey,
    action: 'CREATE',
    entity: 'User',
    entityId: user.id,
    after: { username: input.username, roleKey: input.roleKey },
  });

  return ok(user);
});

