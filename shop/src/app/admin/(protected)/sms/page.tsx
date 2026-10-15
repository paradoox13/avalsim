'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { http } from '@/lib/client/api';
import { toPersianDigits, onlyDigits } from '@/lib/utils/persian';
import { formatJalaliDateTime } from '@/lib/utils/jalali';
import { Send, Filter } from 'lucide-react';

interface SmsRow {
  id: string;
  mobile: string;
  message: string;
  provider: string;
  status: string;
  errorMessage: string | null;
  cost: number | null;
  createdAt: string;
  order?: { orderNumber: string } | null;
  user?: { fullName: string } | null;
}

const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  QUEUED: { label: 'در صف', variant: 'secondary' },
  SENT: { label: 'ارسال‌شده', variant: 'success' },
  DELIVERED: { label: 'تحویل‌شده', variant: 'success' },
  FAILED: { label: 'ناموفق', variant: 'destructive' },
};

export default function AdminSmsPage() {
  const [rows, setRows] = useState<SmsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ mobile: '', message: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (status !== 'all') params.set('status', status);
      if (query) params.set('q', query);
      const result = await http.get<SmsRow[]>(`/api/admin/sms?${params.toString()}`);
      setRows(result.data);
      setTotal(result.meta?.total ?? result.data.length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت لاگ پیامک');
    } finally {
      setLoading(false);
    }
  }, [page, status, query]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      await http.post('/api/admin/sms/send', { mobile: onlyDigits(form.mobile), message: form.message });
      toast.success('پیامک ارسال شد');
      setForm({ mobile: '', message: '' });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ارسال پیامک ناموفق بود');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">مدیریت پیامک‌ها</h2>
        <p className="text-xs text-muted-foreground">
          {toPersianDigits(total)} پیامک — تمام پیامک‌های سیستم در این بخش ثبت می‌شوند
        </p>
      </div>

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">ارسال پیامک دستی</h3>
        <form onSubmit={send} className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
          <div className="space-y-1">
            <Label className="text-xs" required>شماره موبایل</Label>
            <Input
              dir="ltr"
              inputMode="tel"
              placeholder="09121234567"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" required>متن پیامک</Label>
            <Input
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="متن پیامک"
              required
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" loading={sending}>
              <Send className="h-4 w-4" />
              ارسال
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Label className="mb-1 block text-xs">وضعیت</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="SENT">ارسال‌شده</SelectItem>
                <SelectItem value="FAILED">ناموفق</SelectItem>
                <SelectItem value="QUEUED">در صف</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label className="mb-1 block text-xs">جستجو</Label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="شماره یا متن پیامک" />
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
              <TableHead>گیرنده</TableHead>
              <TableHead>متن</TableHead>
              <TableHead>سرویس‌دهنده</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>زمان</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">در حال بارگذاری…</TableCell></TableRow>
            ) : rows.length ? (
              rows.map((row) => {
                const badge = STATUS[row.status] ?? { label: row.status, variant: 'secondary' as const };
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs" dir="ltr">{toPersianDigits(row.mobile)}</TableCell>
                    <TableCell className="max-w-[340px] text-xs">
                      {row.message}
                      {row.errorMessage ? (
                        <span className="mt-1 block text-destructive">{row.errorMessage}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">{row.provider}</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatJalaliDateTime(row.createdAt)}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">پیامکی یافت نشد.</TableCell></TableRow>
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
