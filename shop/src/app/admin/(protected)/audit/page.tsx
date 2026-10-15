import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireStaffUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { formatJalaliDateTime } from '@/lib/utils/jalali';

export const dynamic = 'force-dynamic';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'ایجاد',
  UPDATE: 'ویرایش',
  DELETE: 'حذف',
  LOGIN: 'ورود',
  LOGIN_FAILED: 'ورود ناموفق',
  LOGOUT: 'خروج',
  REGISTER: 'ثبت‌نام',
  REGISTER_RESELLER: 'ثبت‌نام نماینده',
  IMPORT: 'ایمپورت اکسل',
  PAYMENT_VERIFIED: 'تأیید پرداخت',
  PAYMENT_FAILED: 'پرداخت ناموفق',
  CANCEL: 'لغو',
  STATUS_CHANGE: 'تغییر وضعیت',
  SETTLE: 'تسویه',
  UPSERT: 'ثبت/ویرایش',
  PASSWORD_CHANGE: 'تغییر رمز',
};

export default async function AdminAuditPage() {
  await requireStaffUser('audit.read');

  const logs = await prisma.auditLog
    .findMany({
      include: { user: { select: { fullName: true, roleKey: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    .catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">لاگ تغییرات (Audit Log)</h2>
        <p className="text-xs text-muted-foreground">
          ثبت تغییرات مهم سیستم — ۲۰۰ رکورد آخر. مقادیر حساس هرگز در لاگ ذخیره نمی‌شوند.
        </p>
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>زمان</TableHead>
              <TableHead>کاربر</TableHead>
              <TableHead>عملیات</TableHead>
              <TableHead>موجودیت</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>جزئیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length ? (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatJalaliDateTime(log.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {log.user?.fullName ?? log.actorRole ?? 'سیستم'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.action.includes('FAILED') ? 'destructive' : 'secondary'}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {log.entity}
                    {log.entityId ? <span className="block text-muted-foreground">{log.entityId.slice(0, 8)}…</span> : null}
                  </TableCell>
                  <TableCell className="text-xs" dir="ltr">{log.ip ?? '—'}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-[11px] text-muted-foreground" dir="ltr">
                    {log.after ? JSON.stringify(log.after) : log.before ? JSON.stringify(log.before) : '—'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  لاگی ثبت نشده است.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
