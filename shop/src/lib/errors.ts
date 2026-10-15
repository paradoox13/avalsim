export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYMENT_ERROR'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'درخواست نامعتبر است', details?: unknown) =>
  new ApiError(400, 'BAD_REQUEST', message, details);

export const validationError = (message = 'اطلاعات ورودی نامعتبر است', details?: unknown) =>
  new ApiError(422, 'VALIDATION_ERROR', message, details);

export const unauthorized = (message = 'ابتدا وارد حساب خود شوید') =>
  new ApiError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'دسترسی لازم را ندارید') =>
  new ApiError(403, 'FORBIDDEN', message);

export const notFound = (message = 'موردی یافت نشد') => new ApiError(404, 'NOT_FOUND', message);

export const conflict = (message = 'این مورد قبلاً ثبت شده است') =>
  new ApiError(409, 'CONFLICT', message);

export const tooManyRequests = (message = 'تعداد درخواست‌ها بیش از حد مجاز است') =>
  new ApiError(429, 'RATE_LIMITED', message);

export const paymentError = (message = 'خطا در فرآیند پرداخت') =>
  new ApiError(502, 'PAYMENT_ERROR', message);

export const internalError = (message = 'خطای داخلی سرور') =>
  new ApiError(500, 'INTERNAL_ERROR', message);
