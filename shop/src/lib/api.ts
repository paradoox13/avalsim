import { NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from 'zod';
import { ApiError } from './errors';

/** BigInt قابل JSON.stringify نیست — به رشته تبدیل می‌شود */
export function serializeDeep(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeDeep(v);
    }
    return out;
  }
  return value;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data: serializeDeep(data) }, init);
}

export function paginated<T>(items: T[], meta: { page: number; limit: number; total: number }): NextResponse {
  return NextResponse.json({
    ok: true,
    data: serializeDeep(items),
    meta: { ...meta, pages: Math.max(1, Math.ceil(meta.total / meta.limit)) },
  });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message, details: serializeDeep(error.details) } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'اطلاعات ورودی نامعتبر است',
          details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      },
      { status: 422 },
    );
  }
  console.error('[api] unhandled error:', error);
  const message =
    process.env.NODE_ENV === 'production'
      ? 'خطای داخلی سرور رخ داد'
      : error instanceof Error
        ? error.message
        : 'Unknown error';
  return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 });
}

/** پوشش استاندارد route handler: خطاها به پاسخ JSON تبدیل می‌شوند */
export function route<Ctx = unknown>(
  handler: (request: Request, ctx: Ctx) => Promise<NextResponse> | NextResponse,
): (request: Request, ctx: Ctx) => Promise<NextResponse> {
  return async (request: Request, ctx: Ctx) => {
    try {
      return await handler(request, ctx);
    } catch (error) {
      return fail(error);
    }
  };
}

export function getClientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? 'unknown';
}

export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') ?? 'unknown';
}

/**
 * پارس بدنه‌ی JSON با اعتبارسنجی zod.
 * خروجی، نوع *بعد از* ترنسفورم‌ها است (نه ورودی خام کاربر).
 */
export async function readJson<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<ZodInfer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'BAD_REQUEST', 'بدنه‌ی درخواست JSON معتبر نیست');
  }
  return schema.parse(body);
}

/** پارس پارامترهای کوئری با اعتبارسنجی zod */
export function readQuery<S extends ZodTypeAny>(request: Request, schema: S): ZodInfer<S> {
  const url = new URL(request.url);
  const raw: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    const existing = raw[key];
    if (existing === undefined) raw[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else raw[key] = [existing, value];
  }
  return schema.parse(raw);
}

/** مبلغ اعشاری و امن برای درگاه‌های پرداخت (ریال) */
export function respondNoStore<T>(data: T): NextResponse {
  return ok(data, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
