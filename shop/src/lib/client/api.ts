'use client';

let csrfToken: string | null = null;

/** دریافت و کش توکن CSRF (double-submit cookie) */
export async function getCsrfToken(force = false): Promise<string> {
  if (csrfToken && !force) return csrfToken;
  const response = await fetch('/api/auth/csrf', { cache: 'no-store', credentials: 'same-origin' });
  const payload = await response.json();
  csrfToken = String(payload?.data?.csrfToken ?? '');
  return csrfToken as string;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Array<{ path: string; message: string }>;

  constructor(message: string, code: string, status: number, details?: Array<{ path: string; message: string }>) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  meta?: { page: number; limit: number; total: number; pages: number };
  error?: { code: string; message: string; details?: Array<{ path: string; message: string }> };
}

export interface ApiResult<T> {
  data: T;
  meta?: ApiEnvelope<T>['meta'];
}

/**
 * کلاینت استاندارد API: افزودن خودکار توکن CSRF برای درخواست‌های تغییردهنده،
 * پارس پاسخ و پرتاب خطای قابل‌نمایش.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('x-csrf-token', await getCsrfToken());
    if (!(init.body instanceof FormData) && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  let payload: ApiEnvelope<T>;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError('پاسخ سرور نامعتبر بود', 'PARSE_ERROR', response.status);
  }

  if (!response.ok || !payload.ok) {
    const message = payload.error?.message ?? 'خطای نامشخص';
    // توکن منقضی شده: یک‌بار دیگر با توکن تازه تلاش می‌کنیم
    if (response.status === 403 && message.includes('امنیتی')) {
      await getCsrfToken(true);
      return apiFetch<T>(path, init);
    }
    throw new ApiClientError(message, payload.error?.code ?? 'ERROR', response.status, payload.error?.details);
  }

  return { data: payload.data as T, meta: payload.meta };
}

export const http = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};
