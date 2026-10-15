const DEFAULT_TIMEOUT = 15_000;

/**
 * درخواست HTTP با مهلت مشخص و پاسخ JSON امن.
 * درگاه‌های پرداخت و سرویس‌های پیامک ایرانی گاهی کند یا ناپایدار هستند؛
 * بدون مهلت، تایم‌اوت سرور باعث شکست فرآیند خرید می‌شود.
 */
export async function fetchJson(
  url: string,
  init: RequestInit & { timeout?: number } = {},
): Promise<{ status: number; body: unknown }> {
  const { timeout = DEFAULT_TIMEOUT, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeout),
    cache: 'no-store',
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* پاسخ غیر JSON را همان‌گونه برمی‌گردانیم */
  }
  return { status: response.status, body };
}
