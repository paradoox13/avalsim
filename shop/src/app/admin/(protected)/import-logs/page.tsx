import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireStaffUser } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { toPersianDigits } from '@/lib/utils/persian';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  COMPLETED: { label: 'کامل', variant: 'success' },
  PARTIAL: { label: 'با خطای جزئی', variant: 'warning' },
  FAILED: { label: 'ناموفق', variant: 'destructive' },
  PROCESSING: { label: 'در حال پردازش', variant: 'secondary' },
  PENDING: { label: 'در انتظار', variant: 'secondary' },
};

export default async function AdminImportLogsPage() {
  await requireStaffUser('reports.read');

  const logs = await prisma.excelImportLog
    .findMany({ include: { user: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 })
    .catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">تاریخچه‌ی ایمپورت اکسل</h2>
        <p className="text-xs text-muted-foreground">گزارش عملیات ایمپورت گروهی توسط ادمین و نمایندگان</p>
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>زمان</TableHead>
              <TableHead>کاربر</TableHead>
              <TableHead>نوع</TableHead>
              <TableHead>فایل</TableHead>
              <TableHead>کل / موفق / خطا</TableHead>
              <TableHead>وضعیت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length ? (
              logs.map((log) => {
                const status = STATUS[log.status] ?? { label: log.status, variant: 'secondary' as const };
                return (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatJalaliDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs">{log.user.fullName}</TableCell>
                    <TableCell className="text-xs">
                      {log.type === 'PHONE_NUMBER' ? 'شماره' : 'مودم'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs" dir="ltr">{log.fileName}</TableCell>
                    <TableCell className="text-xs">
                      {toPersianDigits(log.totalRows)} / <span className="text-[hsl(var(--success))]">{toPersianDigits(log.successRows)}</span> /{' '}
                      <span className="text-destructive">{toPersianDigits(log.failedRows)}</span>
                    </TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  ایمپورتی ثبت نشده است.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
