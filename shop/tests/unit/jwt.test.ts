import { describe, expect, it } from 'vitest';
import { signSession, verifySession } from '@/lib/auth/jwt';
import { hashPassword, verifyPassword, checkPasswordStrength } from '@/lib/auth/password';

describe('نشست امضاشده (JWT)', () => {
  it('توکن معتبر را تأیید می‌کند', async () => {
    const token = await signSession({ sub: 'user-1', roleKey: 'ADMIN', ver: 3 });
    const payload = await verifySession(token);
    expect(payload?.sub).toBe('user-1');
    expect(payload?.roleKey).toBe('ADMIN');
    expect(payload?.ver).toBe(3);
  });

  it('توکن دست‌کاری‌شده را رد می‌کند', async () => {
    const token = await signSession({ sub: 'user-1', roleKey: 'CUSTOMER', ver: 0 });
    const tampered = `${token.slice(0, -3)}abc`;
    expect(await verifySession(tampered)).toBeNull();
    expect(await verifySession('not-a-token')).toBeNull();
  });

  it('توکن منقضی‌شده را رد می‌کند', async () => {
    const token = await signSession({ sub: 'user-1', roleKey: 'ADMIN', ver: 0 }, -10);
    expect(await verifySession(token)).toBeNull();
  });
});

describe('رمز عبور', () => {
  it('هش و تأیید رمز عبور', async () => {
    const hash = await hashPassword('Strong@Pass123');
    expect(hash).not.toBe('Strong@Pass123');
    expect(await verifyPassword('Strong@Pass123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('رمز کوتاه را رد می‌کند', async () => {
    await expect(hashPassword('123')).rejects.toThrow();
  });

  it('سنجش قدرت رمز عبور', () => {
    expect(checkPasswordStrength('Strong@Pass123').ok).toBe(true);
    expect(checkPasswordStrength('123456').ok).toBe(false);
    expect(checkPasswordStrength('password').ok).toBe(false);
    expect(checkPasswordStrength('abcdefgh').ok).toBe(false);
  });
});
