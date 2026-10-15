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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { http } from '@/lib/client/api';
import { toPersianDigits, onlyDigits } from '@/lib/utils/persian';
import { formatTierRange } from '@/lib/utils/pricing';
import { Plus, Trash2 } from 'lucide-react';

interface PriceRow {
  id: string;
  operatorId: string;
  minQty: number;
  maxQty: number | null;
  unitPrice: string;
  isActive: boolean;
  description: string | null;
}

export default function AdminActivationPage() {
  const [operators, setOperators] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ operatorId: '', minQty: '1', maxQty: '', unitPrice: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await http.get<{ operators: Array<{ id: string; name: string; color: string }>; prices: PriceRow[] }>(
        '/api/admin/activation-prices',
      );
      setOperators(result.data.operators);
      setPrices(result.data.prices);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در دریافت قیمت‌ها');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.operatorId) {
      toast.error('اپراتور را انتخاب کنید');
      return;
    }
    setSaving(true);
    try {
      await http.post('/api/admin/activation-prices', {
        operatorId: form.operatorId,
        unitPrice: onlyDigits(form.unitPrice),
        minQty: Number(onlyDigits(form.minQty) || 1),
        maxQty: form.maxQty ? Number(onlyDigits(form.maxQty)) : null,
        isActive: true,
      });
      toast.success('قیمت ثبت شد');
      setOpen(false);
      setForm({ operatorId: form.operatorId, minQty: '1', maxQty: '', unitPrice: '' });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ثبت قیمت ناموفق بود');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('این پله‌ی قیمت حذف شود؟')) return;
    try {
      await http.delete(`/api/admin/activation-prices/${id}`);
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
          <h2 className="text-lg font-bold">قیمت کد فعال‌سازی</h2>
          <p className="text-xs text-muted-foreground">
            قیمت پله‌ای به تفکیک اپراتور — با افزایش تعداد، قیمت واحد کاهش می‌یابد
          </p>
        </div>
        <Button
          onClick={() => {
            setForm({ operatorId: operators[0]?.id ?? '', minQty: '1', maxQty: '', unitPrice: '' });
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          افزودن/ویرایش قیمت
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {operators.map((operator) => {
          const tiers = prices
            .filter((p) => p.operatorId === operator.id)
            .sort((a, b) => a.minQty - b.minQty);
          return (
            <Card key={operator.id} className="overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: operator.color }} aria-hidden />
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{operator.name}</h3>
                  <Badge variant={tiers.length ? 'success' : 'destructive'}>
                    {tiers.length ? `${toPersianDigits(tiers.length)} پله` : 'بدون قیمت'}
                  </Badge>
                </div>
                {tiers.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>بازه تعداد</TableHead>
                        <TableHead>قیمت واحد</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tiers.map((tier) => (
                        <TableRow key={tier.id}>
                          <TableCell className="text-xs">{formatTierRange(tier)}</TableCell>
                          <TableCell><Money value={tier.unitPrice} /></TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => remove(tier.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    برای این اپراتور قیمتی ثبت نشده است؛ خرید کد فعال‌سازی غیرفعال می‌ماند.
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ثبت پله‌ی قیمت</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label required>اپراتور</Label>
              <select
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={form.operatorId}
                onChange={(e) => setForm({ ...form, operatorId: e.target.value })}
                required
              >
                <option value="">انتخاب کنید…</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label required>از تعداد</Label>
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  value={form.minQty}
                  onChange={(e) => setForm({ ...form, minQty: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>تا تعداد (خالی = بی‌نهایت)</Label>
                <Input dir="ltr" inputMode="numeric" value={form.maxQty} onChange={(e) => setForm({ ...form, maxQty: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label required>قیمت واحد (تومان)</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                required
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              اگر پله‌ای با همان «از تعداد» وجود داشته باشد، به‌جای ثبت جدید به‌روزرسانی می‌شود.
            </p>
            <Button type="submit" loading={saving} className="w-full">ثبت قیمت</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
