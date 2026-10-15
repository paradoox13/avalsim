import { getSettingBoolean, getSettingString, getSetting } from '../settings';
import { createKavenegarProvider } from './kavenegar';
import { createMeliPayamakProvider } from './melipayamak';
import type { SmsProviderAdapter, SmsProviderName } from './types';

export * from './types';
export * from './templates';
export { createKavenegarProvider, createMeliPayamakProvider };

/** ساخت آداپتور سرویس پیامک فعال بر اساس تنظیمات پنل ادمین */
export async function getSmsProvider(): Promise<SmsProviderAdapter | null> {
  const enabled = await getSettingBoolean('sms.enabled');
  if (!enabled) return null;

  const provider = (await getSettingString('sms.provider')) as SmsProviderName;

  if (provider === 'MELIPAYAMAK') {
    const username = await getSettingString('sms.melipayamak.username');
    const password = await getSettingString('sms.melipayamak.password');
    if (!username || !password) return null;
    const sender = await getSettingString('sms.melipayamak.sender');
    return createMeliPayamakProvider({ username, password, sender });
  }

  const apiKey = await getSettingString('sms.kavenegar.apiKey');
  if (!apiKey) return null;
  const sender = await getSettingString('sms.kavenegar.sender');
  return createKavenegarProvider({ apiKey, sender });
}

/** شماره‌ی موبایل ادمین‌ها که باید از خریدها باخبر شوند */
export async function getAdminMobiles(): Promise<string[]> {
  const raw = await getSetting('sms.adminMobiles');
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^09\d{9}$/.test(s));
}
