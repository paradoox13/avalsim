import { issueCsrfToken } from '@/lib/csrf';
import { ok, route } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** دریافت توکن CSRF برای فرم‌های فرانت‌اند */
export const GET = route(async () => {
  const token = await issueCsrfToken();
  return ok({ csrfToken: token });
});
