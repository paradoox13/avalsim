'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/site/money';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { http } from '@/lib/client/api';
import { toPersianDigits } from '@/lib/utils/persian';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { Check, Filter, X } from 'lucide-react';

interface SettlementRow {
  id: string;
  amount: string;
  status: string;
  trackingCode: string | null;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
  reseller: { code: string; shopName: string; userId: string; user: { fullName: string; phone: string } };
}

const STATUS: Record<string, { label: string; variant: 'success' | 'secondary' | 'warning' | 'destructive' }> = {
  PENDING: { label: 'در انتظار پرداخت', variant: 'warning' },
  APPROVED: { label: 'تأییدشده', variant: 'secondary' },
  PAID: { label: 'پرداخت‌شده', variant: 'success' },
  REJECTED: { label: 'ردشده', variant: 'destructive' },
};

export default function AdminSettlementsPage() {
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (status !== 'all') params.set('status', status);
      const result = await http.get<SettlementRow[]>(`/api/admin/settlements?${params.toString()}`);
      setRows(result.data);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت تسویه‌ها');
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: 'pay' | 'reject') {
    if (action === 'reject' && !window.confirm('این تسویه رد شود؟ مبلغ به مانده نماینده بازمی‌گردد.')) return;
    try {
      await http.patch(`/api/admin/settlements/${id}`, {
        action,
        trackingCode: trackingCode || undefined,
        note: action === 'reject' ? 'رد توسط مدیر' : undefined,
      });
      toast.success(action === 'pay' ? 'تسویه پرداخت شد' : 'تسویه رد شد');
      setPayingId(null);
      setTrackingCode('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'عملیات ناموفق بود');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">تسویه با نمایندگان</h2>
        <p className="text-xs text-muted-foreground">{toPersianDigits(total)} رکورد تسویه</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Label className="mb-1 block text-xs">وضعیت</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="PENDING">در انتظار پرداخت</SelectItem>
                <SelectItem value="PAID">پرداخت‌شده</SelectItem>
                <SelectItem value="REJECTED">ردشده</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => { setPage(1); load(); }}>
            <Filter className="h-4 w-4" />
            اعمال
          </Button>
        </div>
      </Card>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نماینده</TableHead>
              <TableHead>مبلغ</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>کد پیگیری</TableHead>
              <TableHead>تاریخ درخواست</TableHead>
              <TableHead>عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">در حال بارگذاری…</TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => {
                const badge = STATUS[row.status] ?? { label: row.status, variant: 'secondary' as const };
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="text-sm">{row.reseller.user.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.reseller.shopName} — <span dir="ltr">{row.reseller.code}</span>
                      </p>
                    </TableCell>
                    <TableCell><Money value={row.amount} /></TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell className="text-xs" dir="ltr">
                      {row.trackingCode ? toPersianDigits(row.trackingCode) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatJalaliDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      {row.status === 'PENDING' || row.status === 'APPROVED' ? (
                        payingId === row.id ? (
                          <div className="flex flex-col gap-1">
                            <Input
                              dir="ltr"
                              className="h-8 w-36 text-xs"
                              placeholder="کد پیگیری بانکی"
                              value={trackingCode}
                              onChange={(e) => setTrackingCode(e.target.value)}
                            />
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => act(row.id, 'pay')}>
                                <Check className="h-3.5 w-3.5" />
                                تأیید پرداخت
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setPayingId(null)}>انصراف</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setPayingId(row.id)}>
                              <Check className="h-3.5 w-3.5" />
                              پرداخت
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => act(row.id, 'reject')}>
                              <X className="h-3.5 w-3.5 text-destructive" />
                              رد
                            </Button>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">تسویه‌ای یافت نشد.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
        <span className="text-xs text-muted-foreground">صفحه {toPersianDigits(page)}</span>
        <Button variant="outline" size="sm" disabled={page * 30 >= total} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
      </div>
    </div>
  );
}
