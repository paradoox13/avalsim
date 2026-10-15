import { ok, route } from '@/lib/api';
import { assertCsrf } from '@/lib/csrf';
import { clearSessionCookie } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { writeAudit } from '@/lib/audit';

export const POST = route(async (request) => {
  await assertCsrf(request);
  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await writeAudit({ userId: user.id, action: 'LOGOUT', entity: 'User', entityId: user.id });
  }
  await clearSessionCookie();
  return ok({ loggedOut: true });
});
