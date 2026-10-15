import { cookies } from 'next/headers';
import { secureToken } from './utils/ids';
import { forbidden } from './errors';
import { CSRF_COOKIE } from './auth/session';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** کوکی توکن CSRF را می‌سازد (الگوی double-submit cookie) */
export async function issueCsrfToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CSRF_COOKIE)?.value;
  if (existing) return existing;
  const token = secureToken(24);
  store.set(CSRF_COOKIE, token, {
    httpOnly: false, // فرانت‌اند باید بتواند آن را در هدر بفرستد
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return token;
}

/** بررسی هم‌مبدأ بودن درخواست (دفاع در برابر CSRF) */
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;
  const origin = request.headers.get('origin');
  if (!origin) return; // برخی کلاینت‌ها (curl/سرور به سرور) هدر Origin ندارند
  const host = request.headers.get('host');
  const allowed = [process.env.NEXT_PUBLIC_APP_URL, process.env.APP_ORIGIN].filter(Boolean) as string[];
  const originHost = safeHost(origin);
  if (host && originHost === host) return;
  if (allowed.some((a) => safeHost(a) === originHost)) return;
  throw forbidden('درخواست از مبدأ غیرمجاز');
}

function safeHost(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * اعتبارسنجی CSRF برای درخواست‌های تغییردهنده:
 * هدر x-csrf-token باید با کوکی هم‌نام یکسان باشد.
 */
export async function assertCsrf(request: Request): Promise<void> {
  assertSameOrigin(request);
  if (SAFE_METHODS.has(request.method)) return;

  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw forbidden('توکن امنیتی نامعتبر است. صفحه را دوباره بارگذاری کنید.');
  }
}
