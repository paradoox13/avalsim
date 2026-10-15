import { prisma } from './prisma';

export interface AuditEntry {
  userId?: string | null;
  actorRole?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * ثبت لاگ تغییرات (Audit Log).
 * خطای ثبت لاگ هرگز نباید عملیات اصلی را متوقف کند.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        actorRole: entry.actorRole ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? undefined) as never,
        after: (entry.after ?? undefined) as never,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] failed to write log:', error);
  }
}

/** فقط فیلدهای تغییر یافته را برای لاگ نگه می‌دارد */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Partial<T>; after: Partial<T> } {
  const changedBefore: Partial<T> = {};
  const changedAfter: Partial<T> = {};
  for (const key of Object.keys(after) as Array<keyof T>) {
    const prev = before[key];
    const next = after[key];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changedBefore[key] = prev;
      changedAfter[key] = next;
    }
  }
  return { before: changedBefore, after: changedAfter };
}

/** حذف داده‌های حساس قبل از ثبت در لاگ */
const SENSITIVE = ['password', 'passwordHash', 'twoFactorSecret', 'apiKey', 'merchantId', 'token'];
export function redact<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = SENSITIVE.some((s) => key.toLowerCase().includes(s.toLowerCase())) ? '***' : value;
  }
  return out;
}
