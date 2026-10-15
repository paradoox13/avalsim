import { fetchJson } from '../utils/http';
import type { SendSmsResult, SmsProviderAdapter } from './types';

/**
 * کاوه‌نگار — REST API
 * مستندات: https://kavenegar.com/rest.html
 * احراز هویت: کلید API در مسیر URL (نه در هدر).
 * پاسخ: { return: { status, message }, entries: [{ messageid, status, statustext, cost }] }
 *
 * برای پیامک‌های خدماتی از الگو (verify/lookup) استفاده می‌شود تا ارسال سریع‌تر و مطمئن‌تر باشد.
 */
export interface KavenegarConfig {
  apiKey: string;
  sender?: string;
}

interface KavenegarEnvelope {
  return?: { status?: number; message?: string };
  entries?: Array<{
    messageid?: number | string;
    status?: number;
    statustext?: string;
    cost?: number;
  }> | { messageid?: number | string; status?: number; cost?: number };
}

export function createKavenegarProvider(config: KavenegarConfig): SmsProviderAdapter {
  const base = `https://api.kavenegar.com/v1/${encodeURIComponent(config.apiKey)}`;

  function interpret(body: unknown, label: string): SendSmsResult {
    const envelope = body as KavenegarEnvelope;
    const status = envelope?.return?.status;
    const rawEntry = envelope?.entries;
    const entry = Array.isArray(rawEntry) ? rawEntry[0] : rawEntry;
    const ok = status === 200 && Boolean(entry?.messageid);
    return {
      ok,
      providerMessageId: entry?.messageid !== undefined ? String(entry.messageid) : undefined,
      cost: entry?.cost,
      errorMessage: ok ? undefined : envelope?.return?.message ?? `${label} ناموفق بود`,
      raw: body,
    };
  }

  return {
    name: 'KAVENEGAR',

    async send(input) {
      // اگر الگو مشخص شده باشد، از اندپوینت lookup استفاده می‌کنیم
      if (input.template) {
        const params = new URLSearchParams({
          receptor: input.mobile,
          template: input.template,
        });
        if (input.tokens?.[0]) params.set('token', input.tokens[0]);
        if (input.tokens?.[1]) params.set('token2', input.tokens[1]);
        if (input.tokens?.[2]) params.set('token3', input.tokens[2]);
        const { body } = await fetchJson(`${base}/verify/lookup.json?${params.toString()}`, {
          method: 'GET',
          timeout: 12_000,
        });
        return interpret(body, 'ارسال پیامک الگو');
      }

      const params = new URLSearchParams({
        receptor: input.mobile,
        message: input.message,
      });
      if (config.sender) params.set('sender', config.sender);

      const { body } = await fetchJson(`${base}/sms/send.json?${params.toString()}`, {
        method: 'GET',
        timeout: 12_000,
      });
      return interpret(body, 'ارسال پیامک');
    },
  };
}
