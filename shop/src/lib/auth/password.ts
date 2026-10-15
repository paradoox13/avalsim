import bcrypt from 'bcryptjs';

/**
 * رمزنگاری رمز عبور با bcrypt.
 * در آرگون۲ به کامپایل native نیاز است که روی بعضی سرورهای ایرانی در دسترس نیست؛
 * bcrypt با هزینه‌ی ۱۲ برای این پروژه امن و قابل‌حمل است.
 */
const COST = Number(process.env.BCRYPT_COST ?? 12);

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 8) throw new Error('رمز عبور باید حداقل ۸ کاراکتر باشد');
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export interface PasswordStrength {
  ok: boolean;
  score: number; // 0..4
  messages: string[];
}

/** اعتبارسنجی قدرت رمز عبور (الزامات امنیتی پروژه) */
export function checkPasswordStrength(password: string): PasswordStrength {
  const messages: string[] = [];
  let score = 0;
  if (password.length >= 8) score += 1;
  else messages.push('رمز عبور باید حداقل ۸ کاراکتر باشد');
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else messages.push('رمز عبور باید شامل حرف بزرگ و کوچک باشد');
  if (/\d/.test(password)) score += 1;
  else messages.push('رمز عبور باید شامل عدد باشد');
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else messages.push('رمز عبور باید شامل کاراکتر ویژه باشد');
  const common = ['123456', 'password', 'qwerty', 'admin', '111111', '12345678'];
  if (common.some((c) => password.toLowerCase().includes(c))) {
    score = 0;
    messages.push('رمز عبور بسیار ساده است');
  }
  return { ok: score >= 3 && password.length >= 8, score: Math.min(4, score), messages };
}
