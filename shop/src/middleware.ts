import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from './lib/auth/jwt';
import { SESSION_COOKIE } from './lib/auth/session';

/**
 * میدل‌ور امنیتی:
 * - محافظت از مسیرهای پنل ادمین و نمایندگان در لبه (edge) پیش از رندر صفحه
 * - افزودن هدرهای امنیتی و شناسه‌ی درخواست
 *
 * نکته: بررسی کامل دسترسی در هر API هم انجام می‌شود (defense in depth)؛
 * این لایه فقط تجربه‌ی کاربری را بهتر و بار سرور را کمتر می‌کند.
 */
export const config = {
  matcher: ['/admin/:path*', '/reseller/:path*', '/account/:path*', '/api/:path*'],
};

const PUBLIC_ADMIN_PATHS = ['/admin/login'];
const PUBLIC_RESELLER_PATHS = ['/reseller/login', '/reseller/register'];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isAdmin = pathname.startsWith('/admin');
  const isReseller = pathname.startsWith('/reseller');
  const isAccount = pathname.startsWith('/account');

  const response = NextResponse.next();
  response.headers.set('x-request-id', crypto.randomUUID());

  if (!isAdmin && !isReseller && !isAccount) return response;

  const isPublic =
    PUBLIC_ADMIN_PATHS.some((p) => pathname === p) ||
    PUBLIC_RESELLER_PATHS.some((p) => pathname === p);
  if (isPublic) return response;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  const loginPath = isAdmin ? '/admin/login' : isReseller ? '/reseller/login' : '/login';

  if (!session) {
    const redirect = new URL(loginPath, request.url);
    redirect.searchParams.set('next', pathname + search);
    return NextResponse.redirect(redirect);
  }

  const role = session.roleKey;
  if (isAdmin && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (isReseller && role !== 'RESELLER') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}
