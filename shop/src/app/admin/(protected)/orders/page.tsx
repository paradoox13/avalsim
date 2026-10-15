'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
import { Download, Eye, Filter } from 'lucide-react';

interface OrderRow {
  id: string;
  orderNumber: string;
  trackingCode: string;
  customerName: string;
  customerPhone: string;
  total: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  items: Array<{ title: string; quantity: number }>;
}

const STATUS_OPTIONS: Array<{ value: string; label: string; variant: 'success' | 'secondary' | 'warning' | 'destructive' | 'default' }> = [
  { value: 'PENDING_PAYMENT', label: 'در انتظار پرداخت', variant: 'warning' },
  { value: 'PAID', label: 'پرداخت‌شده', variant: 'success' },
  { value: 'PROCESSING', label: 'در حال آماده‌سازی', variant: 'default' },
  { value: 'AWAITING_PHYSICAL_DELIVERY', label: 'در انتظار ارسال فیزیکی', variant: 'warning' },
  { value: 'SHIPPED', label: 'ارسال‌شده', variant: 'default' },
  { value: 'DELIVERED', label: 'تحویل‌شده', variant: 'success' },
  { value: 'CANCELED', label: 'لغو‌شده', variant: 'destructive' },
  { value: 'REFUNDED', label: 'مرجوع‌شده', variant: 'destructive' },
  { value: 'FAILED', label: 'ناموفق', variant: 'destructive' },
];

export default function AdminOrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (status !== 'all') params.set('status', status);
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
      const result = await http.get<OrderRow[]>(`/api/admin/orders?${params.toString()}`);
      setRows(result.data);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت سفارش‌ها');
    } finally {
      setLoading(false);
    }
  }, [page, status, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function exportExcel() {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (from) params.set('from', new Date(from).toISOString());
    if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
    window.location.href = `/api/admin/reports/export?type=orders&${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">سفارش‌ها</h2>
          <p className="text-xs text-muted-foreground">{toPersianDigits(total)} سفارش</p>
        </div>
        <Button variant="outline" onClick={exportExcel}>
          <Download className="h-4 w-4" />
          خروجی اکسل
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Label className="mb-1 block text-xs">وضعیت</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">از تاریخ</Label>
            <Input type="date" dir="ltr" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">تا تاریخ</Label>
            <Input type="date" dir="ltr" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
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
              <TableHead>شماره سفارش</TableHead>
              <TableHead>خریدار</TableHead>
              <TableHead>اقلام</TableHead>
              <TableHead>مبلغ</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>تاریخ</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">در حال بارگذاری…</TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => {
                const statusMeta = STATUS_OPTIONS.find((s) => s.value === row.status);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium" dir="ltr">{row.orderNumber}</TableCell>
                    <TableCell>
                      <p className="text-sm">{row.customerName}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{toPersianDigits(row.customerPhone)}</p>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {row.items.map((i) => `${i.title} × ${i.quantity}`).join(' | ')}
                    </TableCell>
                    <TableCell><Money value={row.total} withUnit={false} /></TableCell>
                    <TableCell>
                      <Badge variant={statusMeta?.variant ?? 'secondary'}>
                        {statusMeta?.label ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatJalaliDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild aria-label="جزئیات سفارش">
                        <Link href={`/admin/orders/${row.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  سفارشی با این مشخصات یافت نشد.
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
