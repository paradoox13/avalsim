import { fetchJson } from '../utils/http';
import type { SendSmsResult, SmsProviderAdapter } from './types';

/**
 * ملی‌پیامک — وب‌سرویس REST
 * مستندات: https://www.melipayamak.com/help/راهنمای-وب-سرویس-send/
 * احراز هویت: username/password در بدنه‌ی form (نه هدر).
 * ارسال ساده: POST /api/SendSMS/SendSMS  { username, password, to, from, text, isFlash }
 * ارسال الگو:  POST /api/SendSMS/BaseServiceNumber { username, password, text, to, bodyId }
 * پاسخ: { Value, RetStatus, StrRetStatus } — Value همان RecId یا کد خطا است.
 */
export interface MeliPayamakConfig {
  username: string;
  password: string;
  sender?: string;
  /** شناسه‌ی الگوی ثبت‌شده (bodyId) برای پیامک‌های خدماتی */
  defaultBodyId?: number;
}

const BASE = 'https://rest.payamak-panel.com/api/SendSMS';

interface MeliResponse {
  Value?: string | number;
  RetStatus?: number | string;
  StrRetStatus?: string;
}

export function createMeliPayamakProvider(config: MeliPayamakConfig): SmsProviderAdapter {
  function interpret(body: unknown): SendSmsResult {
    const payload = body as MeliResponse;
    // RetStatus = 1 یعنی درخواست پذیرفته شد؛ Value شناسه‌ی پیام است
    const ok = Number(payload?.RetStatus) === 1;
    const value = payload?.Value !== undefined ? String(payload.Value) : undefined;
    return {
      ok,
      providerMessageId: ok ? value : undefined,
      errorMessage: ok ? undefined : payload?.StrRetStatus ?? `کد خطا: ${value ?? 'نامشخص'}`,
      raw: body,
    };
  }

  return {
    name: 'MELIPAYAMAK',

    async send(input) {
      const isPattern = Boolean(input.template) && config.defaultBodyId !== undefined;

      const form = new URLSearchParams({
        username: config.username,
        password: config.password,
        to: input.mobile,
        text: input.message,
      });

      let url = `${BASE}/SendSMS`;
      if (isPattern) {
        url = `${BASE}/BaseServiceNumber`;
        form.set('bodyId', String(config.defaultBodyId));
      } else {
        if (config.sender) form.set('from', config.sender);
        form.set('isFlash', 'false');
      }

      const { body } = await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        timeout: 12_000,
      });
      return interpret(body);
    },
  };
}
