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
import { http } from '@/lib/client/api';
import { toPersianDigits, onlyDigits } from '@/lib/utils/persian';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { Wallet, Send } from 'lucide-react';

interface SettlementRow {
  id: string;
  amount: string;
  status: string;
  trackingCode: string | null;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface StatsResponse {
  financials: { balance: string; totalSettled: string; totalCommission: string };
}

const STATUS: Record<string, { label: string; variant: 'success' | 'secondary' | 'warning' | 'destructive' }> = {
  PENDING: { label: 'در انتظار پرداخت', variant: 'warning' },
  APPROVED: { label: 'تأییدشده', variant: 'secondary' },
  PAID: { label: 'پرداخت‌شده', variant: 'success' },
  REJECTED: { label: 'ردشده', variant: 'destructive' },
};

export default function ResellerSettlementsPage() {
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, stats] = await Promise.all([
        http.get<SettlementRow[]>('/api/reseller/settlements?limit=50'),
        http.get<StatsResponse>('/api/reseller/stats'),
      ]);
      setRows(list.data);
      setTotal(list.meta?.total ?? list.data.length);
      setBalance(stats.data.financials.balance);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت اطلاعات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function requestSettlement(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await http.post('/api/reseller/settlements', {
        amount: amount ? onlyDigits(amount) : undefined,
        note: note || undefined,
      });
      toast.success('درخواست تسویه ثبت شد');
      setAmount('');
      setNote('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ثبت درخواست ناموفق بود');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">تسویه‌ها</h2>
        <p className="text-xs text-muted-foreground">پیگیری درخواست‌های تسویه با مدیر</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center justify-between p-5">
          <div>
            <p className="text-xs text-muted-foreground">مانده قابل تسویه</p>
            <Money value={balance} className="text-xl font-bold text-primary" />
          </div>
          <Wallet className="h-8 w-8 text-primary/60" aria-hidden />
        </Card>

        <Card className="p-5">
          <form onSubmit={requestSettlement} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">مبلغ (خالی = کل مانده)</Label>
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={balance}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">توضیح</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
            <Button type="submit" loading={submitting} className="w-full">
              <Send className="h-4 w-4" />
              ثبت درخواست تسویه
            </Button>
          </form>
        </Card>
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>مبلغ</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>کد پیگیری</TableHead>
              <TableHead>تاریخ درخواست</TableHead>
              <TableHead>تاریخ پرداخت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">در حال بارگذاری…</TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => {
                const status = STATUS[row.status] ?? { label: row.status, variant: 'secondary' as const };
                return (
                  <TableRow key={row.id}>
                    <TableCell><Money value={row.amount} /></TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                    <TableCell dir="ltr" className="text-xs">
                      {row.trackingCode ? toPersianDigits(row.trackingCode) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatJalaliDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.paidAt ? formatJalaliDateTime(row.paidAt) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  تسویه‌ای ثبت نشده است.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        مجموع درخواست‌ها: {toPersianDigits(total)}
      </p>
    </div>
  );
}
