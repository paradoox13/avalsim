'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { http } from '@/lib/client/api';
import { toPersianDigits, onlyDigits } from '@/lib/utils/persian';
import { formatToman } from '@/lib/utils/money';
import { formatJalaliDate } from '@/lib/utils/jalali';
import { Plus, Trash2, Pencil, Upload } from 'lucide-react';
import Link from 'next/link';

interface PhoneRow {
  id: string;
  msisdn: string;
  price: string;
  status: string;
  isRond: boolean;
  createdAt: string;
  operator: { name: string };
}

const STATUS_LABELS: Record<string, { label: string; variant: 'success' | 'secondary' | 'destructive' | 'warning' }> = {
  AVAILABLE: { label: 'موجود', variant: 'success' },
  RESERVED: { label: 'رزرو', variant: 'warning' },
  SOLD: { label: 'فروخته‌شده', variant: 'secondary' },
  INACTIVE: { label: 'غیرفعال', variant: 'destructive' },
};

export default function ResellerPhonesPage() {
  const [rows, setRows] = useState<PhoneRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ msisdn: '', price: '', description: '' });
  const [editing, setEditing] = useState<PhoneRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', includeSold: 'true', onlyAvailable: 'false' });
      if (query) params.set('q', query);
      const result = await http.get<PhoneRow[]>(`/api/reseller/phones?${params.toString()}`);
      const filtered = statusFilter === 'all'
        ? result.data
        : result.data.filter((row) => row.status === statusFilter);
      setRows(filtered);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت لیست');
    } finally {
      setLoading(false);
    }
  }, [page, query, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function createPhone(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      await http.post('/api/reseller/phones', {
        msisdn: onlyDigits(form.msisdn),
        price: onlyDigits(form.price),
        description: form.description,
      });
      toast.success('شماره ثبت شد');
      setForm({ msisdn: '', price: '', description: '' });
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ثبت شماره ناموفق بود');
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      await http.patch(`/api/reseller/phones/${editing.id}`, {
        price: onlyDigits(form.price),
        description: form.description,
      });
      toast.success('تغییرات ذخیره شد');
      setEditing(null);
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ویرایش ناموفق بود');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('این شماره حذف شود؟')) return;
    try {
      await http.delete(`/api/reseller/phones/${id}`);
      toast.success('شماره حذف شد');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'حذف ناموفق بود');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">شماره‌های من</h2>
          <p className="text-xs text-muted-foreground">{toPersianDigits(total)} شماره ثبت‌شده</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/reseller/import">
              <Upload className="h-4 w-4" />
              ایمپورت اکسل
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setForm({ msisdn: '', price: '', description: '' }); setEditing(null); }}>
                <Plus className="h-4 w-4" />
                ثبت شماره
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'ویرایش شماره' : 'ثبت شماره جدید'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={editing ? saveEdit : createPhone} className="space-y-4">
                {!editing ? (
                  <div className="space-y-2">
                    <Label required>شماره موبایل</Label>
                    <Input
                      dir="ltr"
                      value={form.msisdn}
                      onChange={(e) => setForm({ ...form, msisdn: e.target.value })}
                      placeholder="09121234567"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      اپراتور به‌صورت خودکار از پیش‌شماره تشخیص داده می‌شود.
                    </p>
                  </div>
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
                <Button type="submit" loading={creating} className="w-full">
                  {editing ? 'ذخیره تغییرات' : 'ثبت شماره'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-40">
            <Label className="mb-1 block text-xs">وضعیت</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="AVAILABLE">موجود</SelectItem>
                <SelectItem value="RESERVED">رزرو</SelectItem>
                <SelectItem value="SOLD">فروخته‌شده</SelectItem>
                <SelectItem value="INACTIVE">غیرفعال</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="mb-1 block text-xs">جستجو</Label>
            <Input
              dir="ltr"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بخشی از شماره"
            />
          </div>
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
              <TableHead>تاریخ ثبت</TableHead>
              <TableHead>عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  در حال بارگذاری…
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => {
                const badge = STATUS_LABELS[row.status] ?? { label: row.status, variant: 'secondary' as const };
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium" dir="ltr">
                      {toPersianDigits(row.msisdn)}
                      {row.isRond ? <Badge variant="success" className="ms-2">رند</Badge> : null}
                    </TableCell>
                    <TableCell>{row.operator.name}</TableCell>
                    <TableCell>{formatToman(BigInt(row.price))}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatJalaliDate(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      {row.status === 'AVAILABLE' ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="ویرایش"
                            onClick={() => {
                              setEditing(row);
                              setForm({ msisdn: row.msisdn, price: row.price, description: '' });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => remove(row.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">قابل ویرایش نیست</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  شماره‌ای ثبت نشده است.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          قبلی
        </Button>
        <span className="text-xs text-muted-foreground">صفحه {toPersianDigits(page)}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={page * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          بعدی
        </Button>
      </div>
    </div>
  );
}
