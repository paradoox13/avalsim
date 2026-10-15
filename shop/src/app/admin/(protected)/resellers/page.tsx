'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/site/money';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { http } from '@/lib/client/api';
import { toPersianDigits, onlyDigits } from '@/lib/utils/persian';
import { formatJalaliDate } from '@/lib/utils/jalali';
import { Check, Ban, Pencil, Filter } from 'lucide-react';
import { Suspense } from 'react';

interface ResellerRow {
  id: string;
  code: string;
  shopName: string;
  status: string;
  commissionRate: number;
  balance: string;
  totalSales: string;
  phone: string;
  createdAt: string;
  user: { id: string; fullName: string; phone: string; email: string | null; status: string };
  counts: { phones: number; modems: number };
}

const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  APPROVED: { label: 'تأییدشده', variant: 'success' },
  PENDING_APPROVAL: { label: 'در انتظار تأیید', variant: 'warning' },
  SUSPENDED: { label: 'تعلیق‌شده', variant: 'destructive' },
};

function ResellersContent() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ResellerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ResellerRow | null>(null);
  const [commission, setCommission] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (status !== 'all') params.set('status', status);
      if (query) params.set('q', query);
      const result = await http.get<ResellerRow[]>(`/api/admin/resellers?${params.toString()}`);
      setRows(result.data);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت لیست');
    } finally {
      setLoading(false);
    }
  }, [page, status, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(row: ResellerRow, action: 'approve' | 'suspend' | 'activate') {
    const labels = { approve: 'تأیید', suspend: 'تعلیق', activate: 'فعال‌سازی' } as const;
    if (!window.confirm(`آیا از ${labels[action]} نماینده «${row.shopName}» مطمئن هستید؟`)) return;
    try {
      await http.patch(`/api/admin/resellers/${row.id}`, { action });
      toast.success(`نماینده ${labels[action]} شد`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'عملیات ناموفق بود');
    }
  }

  async function saveCommission(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await http.patch(`/api/admin/resellers/${editing.id}`, {
        action: 'update',
        commissionRate: Number(onlyDigits(commission) || 0),
      });
      toast.success('نرخ کمیسیون به‌روزرسانی شد');
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره ناموفق بود');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">مدیریت نمایندگان</h2>
        <p className="text-xs text-muted-foreground">{toPersianDigits(total)} نماینده</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Label className="mb-1 block text-xs">وضعیت</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="PENDING_APPROVAL">در انتظار تأیید</SelectItem>
                <SelectItem value="APPROVED">تأییدشده</SelectItem>
                <SelectItem value="SUSPENDED">تعلیق‌شده</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label className="mb-1 block text-xs">جستجو</Label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="نام، کد نماینده یا موبایل" />
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
              <TableHead>کد</TableHead>
              <TableHead>نماینده / فروشگاه</TableHead>
              <TableHead>محصولات</TableHead>
              <TableHead>فروش کل</TableHead>
              <TableHead>مانده</TableHead>
              <TableHead>کمیسیون</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">در حال بارگذاری…</TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => {
                const badge = STATUS[row.status] ?? { label: row.status, variant: 'warning' as const };
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs" dir="ltr">{row.code}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{row.user.fullName}</p>
                      <p className="text-xs text-muted-foreground">{row.shopName}</p>
                      <p className="text-[11px] text-muted-foreground" dir="ltr">{toPersianDigits(row.user.phone)}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      شماره: {toPersianDigits(row.counts.phones)}
                      <br />
                      مودم: {toPersianDigits(row.counts.modems)}
                    </TableCell>
                    <TableCell className="text-xs"><Money value={row.totalSales} withUnit={false} /></TableCell>
                    <TableCell className="text-xs"><Money value={row.balance} withUnit={false} /></TableCell>
                    <TableCell className="text-xs">{toPersianDigits(row.commissionRate / 100)}٪</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.status !== 'APPROVED' ? (
                          <Button variant="ghost" size="icon" aria-label="تأیید" onClick={() => act(row, 'approve')}>
                            <Check className="h-4 w-4 text-[hsl(var(--success))]" />
                          </Button>
                        ) : null}
                        {row.status !== 'SUSPENDED' ? (
                          <Button variant="ghost" size="icon" aria-label="تعلیق" onClick={() => act(row, 'suspend')}>
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" aria-label="فعال‌سازی" onClick={() => act(row, 'activate')}>
                            <Check className="h-4 w-4 text-[hsl(var(--success))]" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="ویرایش کمیسیون"
                          onClick={() => {
                            setEditing(row);
                            setCommission(String(row.commissionRate / 100));
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">نماینده‌ای یافت نشد.</TableCell>
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

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ویرایش نرخ کمیسیون {editing?.shopName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveCommission} className="space-y-4">
            <div className="space-y-2">
              <Label required>درصد کمیسیون</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="5"
              />
              <p className="text-[11px] text-muted-foreground">
                کمیسیون از مبلغ فروش کالاهای این نماینده محاسبه و به مانده‌ی او اضافه می‌شود.
              </p>
            </div>
            <Button type="submit" loading={saving} className="w-full">ذخیره</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminResellersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>}>
      <ResellersContent />
    </Suspense>
  );
}
