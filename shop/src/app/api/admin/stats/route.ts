import { ok, route } from '@/lib/api';
import { requireStaffUser } from '@/lib/guards';
import { getDashboardStats } from '@/lib/services/report.service';

export const dynamic = 'force-dynamic';

/** داشبورد آماری ادمین */
export const GET = route(async () => {
  await requireStaffUser('dashboard.view');
  const stats = await getDashboardStats();
  return ok(stats);
});
