'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/site/money';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { http } from '@/lib/client/api';
import { toPersianDigits } from '@/lib/utils/persian';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { ORDER_STATUS_LABELS } from '@/lib/sms/templates';
import { Download, Filter } from 'lucide-react';

interface OrderReport {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: string;
  resellerCommission: string;
  status: string;
  createdAt: string;
  items: Array<{ title: string; quantity: number }>;
}

interface OperatorReport {
  operatorId: string | null;
  operatorName: string;
  ordersCount: number;
  quantity: number;
  amount: string;
}

interface ResellerReport {
  code: string;
  resellerName: string;
  shopName: string;
  ordersCount: number;
  amount: string;
  commission: string;
  balance: string;
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState('orders');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderReport[]>([]);
  const [operators, setOperators] = useState<OperatorReport[]>([]);
  const [resellers, setResellers] = useState<ResellerReport[]>([]);
  const [summary, setSummary] = useState<{ totalAmount: string; totalCommission: string } | null>(null);

  const rangeParams = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', new Date(from).toISOString());
    if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
    return params;
  }, [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = rangeParams();
      params.set('type', tab);
      const result = await http.get<
        | { type: 'orders'; rows: OrderReport[]; summary: { totalAmount: string; totalCommission: string } }
        | { type: 'operators'; rows: OperatorReport[] }
        | { type: 'resellers'; rows: ResellerReport[] }
      >(`/api/admin/reports?${params.toString()}`);

      if (result.data.type === 'operators') setOperators(result.data.rows);
      else if (result.data.type === 'resellers') setResellers(result.data.rows);
      else {
        setOrders(result.data.rows);
        setSummary(result.data.summary);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت گزارش');
    } finally {
      setLoading(false);
    }
  }, [tab, rangeParams]);

  useEffect(() => {
    load();
  }, [load]);

  function exportExcel(type: string) {
    const params = rangeParams();
    params.set('type', type);
    window.location.href = `/api/admin/reports/export?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">گزارش‌های خرید و فروش</h2>
        <p className="text-xs text-muted-foreground">
          گزارش سفارش‌ها، فروش به تفکیک اپراتور و عملکرد نمایندگان — با قابلیت خروجی اکسل
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="mb-1 block text-xs">از تاریخ</Label>
            <Input type="date" dir="ltr" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">تا تاریخ</Label>
            <Input type="date" dir="ltr" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={load}>
            <Filter className="h-4 w-4" />
            اعمال فیلتر
          </Button>
          <Button variant="outline" className="ms-auto" onClick={() => exportExcel(tab)}>
            <Download className="h-4 w-4" />
            خروجی اکسل این گزارش
          </Button>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="orders">سفارش‌ها</TabsTrigger>
          <TabsTrigger value="operators">فروش اپراتورها</TabsTrigger>
          <TabsTrigger value="resellers">عملکرد نمایندگان</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          {summary ? (
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">جمع مبلغ سفارش‌ها</p>
                <Money value={summary.totalAmount} className="text-lg font-bold" />
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">جمع کمیسیون نمایندگان</p>
                <Money value={summary.totalCommission} className="text-lg font-bold" />
              </Card>
            </div>
          ) : null}
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>سفارش</TableHead>
                  <TableHead>خریدار</TableHead>
                  <TableHead>اقلام</TableHead>
                  <TableHead>مبلغ</TableHead>
                  <TableHead>کمیسیون</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">در حال بارگذاری…</TableCell></TableRow>
                ) : orders.length ? (
                  orders.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs font-medium" dir="ltr">{row.orderNumber}</TableCell>
                      <TableCell className="text-xs">
                        {row.customerName}
                        <span className="block text-muted-foreground" dir="ltr">{toPersianDigits(row.customerPhone)}</span>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {row.items.map((i) => `${i.title} × ${i.quantity}`).join(' | ')}
                      </TableCell>
                      <TableCell><Money value={row.total} withUnit={false} /></TableCell>
                      <TableCell><Money value={row.resellerCommission} withUnit={false} /></TableCell>
                      <TableCell className="text-xs">{ORDER_STATUS_LABELS[row.status] ?? row.status}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatJalaliDateTime(row.createdAt)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">داده‌ای یافت نشد.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="operators">
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اپراتور</TableHead>
                  <TableHead>تعداد سفارش</TableHead>
                  <TableHead>تعداد کالا</TableHead>
                  <TableHead>مبلغ فروش</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operators.length ? (
                  operators.map((row) => (
                    <TableRow key={row.operatorId ?? row.operatorName}>
                      <TableCell>{row.operatorName}</TableCell>
                      <TableCell>{toPersianDigits(row.ordersCount)}</TableCell>
                      <TableCell>{toPersianDigits(row.quantity)}</TableCell>
                      <TableCell><Money value={row.amount} /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">داده‌ای یافت نشد.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="resellers">
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>کد</TableHead>
                  <TableHead>نماینده</TableHead>
                  <TableHead>فروشگاه</TableHead>
                  <TableHead>تعداد فروش</TableHead>
                  <TableHead>مبلغ</TableHead>
                  <TableHead>کمیسیون</TableHead>
                  <TableHead>مانده</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resellers.length ? (
                  resellers.map((row) => (
                    <TableRow key={row.code}>
                      <TableCell className="text-xs" dir="ltr">{row.code}</TableCell>
                      <TableCell className="text-sm">{row.resellerName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.shopName}</TableCell>
                      <TableCell>{toPersianDigits(row.ordersCount)}</TableCell>
                      <TableCell><Money value={row.amount} withUnit={false} /></TableCell>
                      <TableCell><Money value={row.commission} withUnit={false} /></TableCell>
                      <TableCell><Money value={row.balance} withUnit={false} /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">داده‌ای یافت نشد.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
