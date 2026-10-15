'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/site/money';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { http } from '@/lib/client/api';
import { toPersianDigits } from '@/lib/utils/persian';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { Download, Filter } from 'lucide-react';

interface SaleRow {
  id: string;
  title: string;
  productType: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  commissionAmount: string;
  createdAt: string;
  order: { orderNumber: string; customerName: string; status: string; paidAt: string | null };
}

const TYPE_LABELS: Record<string, string> = {
  PHONE_NUMBER: 'شماره',
  MODEM: 'مودم',
  ACTIVATION_CODE: 'کد فعال‌سازی',
};

export default function ResellerReportsPage() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
      const result = await http.get<SaleRow[]>(`/api/reseller/reports?${params.toString()}`);
      setRows(result.data);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت گزارش');
    } finally {
      setLoading(false);
    }
  }, [page, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = rows.reduce(
    (acc, row) => ({
      amount: acc.amount + BigInt(row.totalPrice),
      commission: acc.commission + BigInt(row.commissionAmount),
    }),
    { amount: 0n, commission: 0n },
  );

  function exportExcel() {
    const params = new URLSearchParams();
    if (from) params.set('from', new Date(from).toISOString());
    if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
    window.location.href = `/api/reseller/reports/export?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">گزارش فروش</h2>
          <p className="text-xs text-muted-foreground">{toPersianDigits(total)} رکورد فروش</p>
        </div>
        <Button onClick={exportExcel} variant="outline">
          <Download className="h-4 w-4" />
          خروجی اکسل
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="mb-1 block text-xs">از تاریخ</Label>
            <Input type="date" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">تا تاریخ</Label>
            <Input type="date" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" onClick={() => { setPage(1); load(); }}>
            <Filter className="h-4 w-4" />
            اعمال فیلتر
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">جمع فروش (این صفحه)</p>
          <Money value={totals.amount} className="text-lg font-bold" />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">جمع کمیسیون (این صفحه)</p>
          <Money value={totals.commission} className="text-lg font-bold" />
        </Card>
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>محصول</TableHead>
              <TableHead>نوع</TableHead>
              <TableHead>تعداد</TableHead>
              <TableHead>مبلغ</TableHead>
              <TableHead>کمیسیون</TableHead>
              <TableHead>خریدار</TableHead>
              <TableHead>تاریخ فروش</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">در حال بارگذاری…</TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[200px] truncate">{row.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{TYPE_LABELS[row.productType] ?? row.productType}</Badge>
                  </TableCell>
                  <TableCell>{toPersianDigits(row.quantity)}</TableCell>
                  <TableCell><Money value={row.totalPrice} withUnit={false} /></TableCell>
                  <TableCell><Money value={row.commissionAmount} withUnit={false} /></TableCell>
                  <TableCell className="text-xs">{row.order.customerName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.order.paidAt ? formatJalaliDateTime(row.order.paidAt) : '-'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  فروشی در این بازه ثبت نشده است.
                </TableCell>
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
