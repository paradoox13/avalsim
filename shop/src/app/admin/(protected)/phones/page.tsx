'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { http } from '@/lib/client/api';
import { toPersianDigits, onlyDigits } from '@/lib/utils/persian';
import { formatToman } from '@/lib/utils/money';
import { formatJalaliDate } from '@/lib/utils/jalali';
import { Plus, Trash2, Pencil, Upload, Filter } from 'lucide-react';

interface PhoneRow {
  id: string;
  msisdn: string;
  price: string;
  status: string;
  isRond: boolean;
  isSequential: boolean;
  createdAt: string;
  ownerType: string;
  operator: { id: string; name: string; color: string };
  reseller?: { fullName: string } | null;
}

const STATUS: Record<string, { label: string; variant: 'success' | 'secondary' | 'warning' | 'destructive' }> = {
  AVAILABLE: { label: 'موجود', variant: 'success' },
  RESERVED: { label: 'رزرو', variant: 'warning' },
  SOLD: { label: 'فروخته‌شده', variant: 'secondary' },
  INACTIVE: { label: 'غیرفعال', variant: 'destructive' },
};

export default function AdminPhonesPage() {
  const [rows, setRows] = useState<PhoneRow[]>([]);
  const [operators, setOperators] = useState<Array<{ id: string; name: string }>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('AVAILABLE');
  const [operatorId, setOperatorId] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PhoneRow | null>(null);
  const [form, setForm] = useState({ msisdn: '', price: '', operatorId: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      params.set('includeSold', 'true');
      params.set('onlyAvailable', 'false');
      if (status !== 'all') params.set('statuses', status);
      if (operatorId !== 'all') params.set('operators', operatorId);
      if (query) params.set('q', query);
      const result = await http.get<PhoneRow[]>(`/api/admin/phones?${params.toString()}`);
      setRows(status === 'all' ? result.data : result.data);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت لیست');
    } finally {
      setLoading(false);
    }
  }, [page, status, operatorId, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    http
      .get<Array<{ id: string; name: string }>>('/api/operators')
      .then((result) => setOperators(result.data))
      .catch(() => undefined);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await http.patch(`/api/admin/phones/${editing.id}`, {
          price: onlyDigits(form.price),
          description: form.description,
        });
        toast.success('شماره ویرایش شد');
      } else {
        await http.post('/api/admin/phones', {
          msisdn: onlyDigits(form.msisdn),
          price: onlyDigits(form.price),
          operatorId: form.operatorId || undefined,
          description: form.description,
        });
        toast.success('شماره ثبت شد');
      }
      setOpen(false);
      setEditing(null);
      setForm({ msisdn: '', price: '', operatorId: '', description: '' });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ذخیره‌سازی ناموفق بود');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('این شماره حذف شود؟')) return;
    try {
      await http.delete(`/api/admin/phones/${id}`);
      toast.success('حذف شد');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'حذف ناموفق بود');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">مدیریت شماره‌ها</h2>
          <p className="text-xs text-muted-foreground">{toPersianDigits(total)} شماره</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/import">
              <Upload className="h-4 w-4" />
              ایمپورت اکسل
            </Link>
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ msisdn: '', price: '', operatorId: '', description: '' });
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            ثبت شماره
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Label className="mb-1 block text-xs">وضعیت</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="AVAILABLE">موجود</SelectItem>
                <SelectItem value="RESERVED">رزرو</SelectItem>
                <SelectItem value="SOLD">فروخته‌شده</SelectItem>
                <SelectItem value="INACTIVE">غیرفعال</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Label className="mb-1 block text-xs">اپراتور</Label>
            <Select value={operatorId} onValueChange={(v) => { setOperatorId(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px] flex-1">
            <Label className="mb-1 block text-xs">جستجو</Label>
            <Input dir="ltr" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بخشی از شماره" />
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
              <TableHead>شماره</TableHead>
              <TableHead>اپراتور</TableHead>
              <TableHead>قیمت</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>مالک</TableHead>
              <TableHead>ویژگی</TableHead>
              <TableHead>تاریخ</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">در حال بارگذاری…</TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => {
                const badge = STATUS[row.status] ?? { label: row.status, variant: 'secondary' as const };
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium" dir="ltr">{toPersianDigits(row.msisdn)}</TableCell>
                    <TableCell>{row.operator.name}</TableCell>
                    <TableCell>{formatToman(BigInt(row.price))}</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {row.ownerType === 'RESELLER' ? `نماینده: ${row.reseller?.fullName ?? '-'}` : 'پلتفرم'}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {row.isRond ? <Badge variant="success">رند</Badge> : null}
                        {row.isSequential ? <Badge variant="secondary">متوالی</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatJalaliDate(row.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="ویرایش"
                          onClick={() => {
                            setEditing(row);
                            setForm({ msisdn: row.msisdn, price: row.price, operatorId: row.operator.id, description: '' });
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="حذف"
                          disabled={row.status === 'SOLD'}
                          onClick={() => remove(row.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">شماره‌ای یافت نشد.</TableCell>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'ویرایش شماره' : 'ثبت شماره جدید'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {!editing ? (
              <>
                <div className="space-y-2">
                  <Label required>شماره موبایل</Label>
                  <Input
                    dir="ltr"
                    value={form.msisdn}
                    onChange={(e) => setForm({ ...form, msisdn: e.target.value })}
                    placeholder="09121234567"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>اپراتور (خالی = تشخیص خودکار)</Label>
                  <Select value={form.operatorId} onValueChange={(value) => setForm({ ...form, operatorId: value })}>
                    <SelectTrigger><SelectValue placeholder="تشخیص خودکار" /></SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground" dir="ltr">{toPersianDigits(editing.msisdn)}</p>
            )}
            <div className="space-y-2">
              <Label required>قیمت (تومان)</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>توضیحات</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button type="submit" loading={saving} className="w-full">
              {editing ? 'ذخیره تغییرات' : 'ثبت شماره'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
