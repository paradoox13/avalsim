import { cookies } from 'next/headers';
import { CART_COOKIE } from './auth/session';
import { secureToken } from './utils/ids';

const MAX_AGE = 60 * 60 * 24 * 14; // ۱۴ روز

/**
 * خواندن یا ساخت توکن سبد خرید در کوکی.
 * توکن تصادفی و غیرقابل حدس است تا سبدهای دیگران قابل دستکاری نباشند.
 */
export async function getCartToken(options: { create?: boolean } = {}): Promise<string | undefined> {
  const store = await cookies();
  const existing = store.get(CART_COOKIE)?.value;
  if (existing) return existing;
  if (!options.create) return undefined;

  const token = secureToken(24);
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return token;
}
