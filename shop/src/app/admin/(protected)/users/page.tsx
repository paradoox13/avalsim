'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { Plus, KeyRound, ShieldCheck, Ban, Filter } from 'lucide-react';

interface UserRow {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  username: string | null;
  roleKey: string;
  status: string;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: 'مشتری',
  RESELLER: 'نماینده',
  ADMIN: 'مدیر',
  SUPER_ADMIN: 'مدیر کل',
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roleKey, setRoleKey] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    username: '',
    email: '',
    password: '',
    roleKey: 'ADMIN',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (roleKey !== 'all') params.set('roleKey', roleKey);
      if (query) params.set('q', query);
      const result = await http.get<UserRow[]>(`/api/admin/users?${params.toString()}`);
      setRows(result.data);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت کاربران');
    } finally {
      setLoading(false);
    }
  }, [page, roleKey, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await http.post('/api/admin/users', { ...form, phone: onlyDigits(form.phone) });
      toast.success('کاربر ساخته شد');
      setOpen(false);
      setForm({ fullName: '', phone: '', username: '', email: '', password: '', roleKey: 'ADMIN' });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ساخت کاربر ناموفق بود');
    } finally {
      setSaving(false);
    }
  }

  async function act(user: UserRow, action: 'status' | 'role', value: string) {
    try {
      await http.patch(`/api/admin/users/${user.id}`, { action, [action === 'status' ? 'status' : 'roleKey']: value });
      toast.success('به‌روزرسانی شد');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'عملیات ناموفق بود');
    }
  }

  async function resetPassword(user: UserRow) {
    const newPassword = window.prompt(`رمز عبور جدید برای ${user.fullName} (حداقل ۱۰ کاراکتر):`);
    if (!newPassword) return;
    try {
      await http.patch(`/api/admin/users/${user.id}`, { action: 'reset-password', newPassword });
      toast.success('رمز عبور بازنشانی شد و نشست‌های کاربر باطل شد');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'بازنشانی ناموفق بود');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">کاربران و نقش‌ها</h2>
          <p className="text-xs text-muted-foreground">{toPersianDigits(total)} کاربر</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          ساخت کاربر کارکنان
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Label className="mb-1 block text-xs">نقش</Label>
            <Select value={roleKey} onValueChange={(v) => { setRoleKey(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="CUSTOMER">مشتری</SelectItem>
                <SelectItem value="RESELLER">نماینده</SelectItem>
                <SelectItem value="ADMIN">مدیر</SelectItem>
                <SelectItem value="SUPER_ADMIN">مدیر کل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label className="mb-1 block text-xs">جستجو</Label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="نام، موبایل یا نام کاربری" />
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
              <TableHead>کاربر</TableHead>
              <TableHead>نام کاربری</TableHead>
              <TableHead>نقش</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>۲FA</TableHead>
              <TableHead>آخرین ورود</TableHead>
              <TableHead>عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">در حال بارگذاری…</TableCell></TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="text-sm">{row.fullName}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{toPersianDigits(row.phone)}</p>
                  </TableCell>
                  <TableCell className="text-xs" dir="ltr">{row.username ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={row.roleKey === 'SUPER_ADMIN' ? 'default' : 'secondary'}>
                      {ROLE_LABELS[row.roleKey] ?? row.roleKey}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'ACTIVE' ? 'success' : row.status === 'SUSPENDED' ? 'destructive' : 'warning'}>
                      {row.status === 'ACTIVE' ? 'فعال' : row.status === 'SUSPENDED' ? 'غیرفعال' : 'در انتظار'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.twoFactorEnabled ? (
                      <ShieldCheck className="h-4 w-4 text-[hsl(var(--success))]" aria-label="فعال" />
                    ) : (
                      <span className="text-xs text-muted-foreground">غیرفعال</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.lastLoginAt ? formatJalaliDateTime(row.lastLoginAt) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.status === 'ACTIVE' ? (
                        <Button variant="ghost" size="icon" aria-label="غیرفعال‌سازی" onClick={() => act(row, 'status', 'SUSPENDED')}>
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" aria-label="فعال‌سازی" onClick={() => act(row, 'status', 'ACTIVE')}>
                          <ShieldCheck className="h-4 w-4 text-[hsl(var(--success))]" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" aria-label="بازنشانی رمز" onClick={() => resetPassword(row)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">کاربری یافت نشد.</TableCell></TableRow>
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
            <DialogTitle>ساخت کاربر کارکنان</DialogTitle>
          </DialogHeader>
          <form onSubmit={create} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label required>نام کامل</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label required>موبایل</Label>
                <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label required>نام کاربری</Label>
                <Input
                  dir="ltr"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>ایمیل</Label>
                <Input dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label required>رمز عبور</Label>
                <Input
                  dir="ltr"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label required>نقش</Label>
                <Select value={form.roleKey} onValueChange={(value) => setForm({ ...form, roleKey: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">مدیر</SelectItem>
                    <SelectItem value="SUPER_ADMIN">مدیر کل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" loading={saving} className="w-full">ساخت کاربر</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
