import { ok, route } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return ok({ user: null });

  const profile =
    user.roleKey === 'RESELLER'
      ? await prisma.resellerProfile.findUnique({
          where: { userId: user.id },
          select: { id: true, code: true, shopName: true, status: true, balance: true, commissionRate: true },
        })
      : null;

  return ok({ user, resellerProfile: profile });
});
