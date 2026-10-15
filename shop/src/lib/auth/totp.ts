import { authenticator } from 'otplib';
import QRCode from 'qrcode';

/**
 * ورود دو مرحله‌ای (TOTP) برای ادمین و مدیر کل.
 * سازگار با Google Authenticator و اپ‌های مشابه.
 */
authenticator.options = { window: 1, step: 30 };

const ISSUER = process.env.APP_NAME ?? 'SimShop';

export function generateTwoFactorSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(secret: string, accountName: string): string {
  return authenticator.keyuri(accountName, ISSUER, secret);
}

export async function buildQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
}

export function verifyTwoFactorCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code.replace(/\D/g, ''), secret });
  } catch {
    return false;
  }
}

/** کدهای پشتیبان یک‌بارمصرف */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = authenticator.generateSecret().slice(0, 10).toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}
