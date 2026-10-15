import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface SessionClaims extends JWTPayload {
  sub: string; // شناسه‌ی کاربر
  roleKey: string;
  ver: number; // tokenVersion کاربر — برای باطل‌سازی فوری
  rid?: string; // شناسه‌ی نمایندگی (در صورت وجود)
  tfa?: boolean; // آیا تأیید دو مرحله‌ای انجام شده است
}

const ISSUER = 'simshop';
const AUDIENCE = 'simshop-web';
const ALG = 'HS256';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // ۷ روز

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // در محیط تولید نباید اجازه‌ی اجرا با کلید ضعیف داد
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET باید حداقل ۳۲ کاراکتر و در متغیرهای محیطی تنظیم شده باشد');
    }
    return new TextEncoder().encode('dev-only-insecure-secret-change-me-please-32');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(claims: Omit<SessionClaims, 'iat' | 'exp' | 'iss' | 'aud'>, maxAge = SESSION_MAX_AGE_SECONDS): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALG],
      clockTolerance: 5,
    });
    if (typeof payload.sub !== 'string' || typeof payload.roleKey !== 'string') return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

/** توکن کوتاه‌عمر برای تأیید مرحله‌ی دوم ورود ادمین */
export async function signPendingTwoFactor(userId: string): Promise<string> {
  return signSession({ sub: userId, roleKey: 'PENDING_2FA', ver: 0, tfa: false }, 300);
}
